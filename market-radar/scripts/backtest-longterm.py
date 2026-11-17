#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""MARKET RADAR historic weekly factors study (corrected rank direction).

Run with an Internet connection:
  pip install pandas numpy requests
  python taiwan_backtest_v3.py --start-year 2024 --end-year 2026 --asof 2026-11-16
  python taiwan_backtest_v3.py --self-test

The code downloads daily TWSE archive files from joy40217/TWSE-daily.
No computed strategy performance is asserted until real files have been downloaded.
This program is research software, not an auto-trading system.
"""
from __future__ import annotations
import argparse
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
import csv
import io
import json
import math
import os
from pathlib import Path
import random
import sys
import time
from datetime import date, timedelta
import numpy as np
import pandas as pd
import requests

REPO = "joy40217/TWSE-daily"
RAW = f"https://raw.githubusercontent.com/{REPO}/main/data"
API = f"https://api.github.com/repos/{REPO}/contents/data/stock_day_all"
SYMBOLS = {"0050": "元大台灣50", "2330": "台積電", "2383": "台光電", "2327": "國巨", "3026": "禾伸堂", "2308": "台達電", "2317": "鴻海"}
STOCKS = [s for s in SYMBOLS if s != "0050"]
FEATURES = ["foreign", "trust", "margin", "momentum"]
FEE_BUY = 0.001425  # full-rate broker commission; discounts excluded
FEE_SELL_STOCK = 0.001425 + 0.003  # Taiwan individual-stock transaction tax
FEE_SELL_ETF = 0.001425 + 0.001
SPLITS = {"0050": ("2025-06-18", 4.0), "2327": ("2025-08-25", 4.0)}


def req(url, timeout=30, attempts=5):
    for n in range(attempts):
        try:
            resp = requests.get(url, timeout=timeout, headers={"User-Agent": "tw-factors-backtest/3 research", "Accept": "application/vnd.github+json"})
            if resp.status_code in (403, 429, 500, 502, 503, 504):
                raise RuntimeError(f"HTTP {resp.status_code}: {resp.text[:120]}")
            resp.raise_for_status()
            return resp.content
        except (requests.RequestException, RuntimeError):
            if n == attempts - 1: raise
            time.sleep(min(1.5 * 2 ** n, 12) + random.random() * 0.1)


def cache_get(path: Path, url: str) -> bytes:
    if path.is_file() and path.stat().st_size > 16:
        return path.read_bytes()
    b = req(url)
    if len(b) <= 16: raise ValueError(f"Suspicious empty file: {url}")
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_bytes(b)
    os.replace(temp, path)
    return b


def list_dates(year: int, cache: Path, refresh: bool=False) -> list[str]:
    target = cache / "indexes" / f"{year}.json"
    if refresh and target.exists(): target.unlink()
    a = json.loads(cache_get(target, f"{API}/{year}").decode("utf-8-sig"))
    return sorted(z["name"][:10] for z in a if isinstance(z, dict) and len(z.get("name", "")) == 14 and z["name"].endswith(".csv"))


def week_monday(day: str) -> str:
    d = date.fromisoformat(day)
    return (d - timedelta(days=d.weekday())).isoformat()


def anchors(dates: list[str]) -> list[dict]:
    weeks = defaultdict(list)
    for d in sorted(set(dates)): weeks[week_monday(d)].append(d)
    return [{"week":k, "first": v[0], "last": v[-1]} for k,v in sorted(weeks.items())]


def csvmap(content: bytes, dataset: str) -> dict:
    inp = csv.DictReader(io.StringIO(content.decode("utf-8-sig")))
    out = {}
    for row in inp:
        if dataset == "stock_day_all":
            code = row.get("Code", "").strip()
            if code not in SYMBOLS: continue
            try: out[code] = {"open":float(row["OpeningPrice"].replace(",", "")),
                                      "close":float(row["ClosingPrice"].replace(",", "")),
                                      "vol":float(row["TradeVolume"].replace(",", ""))}
            except (ValueError, TypeError, KeyError): continue
        elif dataset == "institutional":
            code = row.get("證券代號", "").strip()
            if code not in STOCKS: continue
            try: out[code] = {"foreign":float(row["外陸資買賣超股數(不含外資自營商)"].replace(",", "")),
                                      "trust":float(row["投信買賣超股數"].replace(",", ""))}
            except (ValueError, TypeError, KeyError): continue
        elif dataset == "margin":
            code = row.get("股票代號", "").strip()
            if code not in STOCKS: continue
            try: out[code] = {"prev":float(row["融資前日餘額"].replace(",", "")),
                                      "curr":float(row["融資今日餘額"].replace(",", ""))}
            except (ValueError, TypeError, KeyError): continue
    return out


def adjusted_price(code: str, d: str, px: float) -> float:
    if code in SPLITS:
        split_date, multiple = SPLITS[code]
        if d < split_date: return px / multiple
    return px


def load_archive(weekly: list[dict], cache: Path, workers=6, asof: str="2026-11-16"):
    jobs=set()
    for k in range(len(weekly)-2):
        sig, ent, ex = weekly[k]["last"], weekly[k+1]["first"], weekly[k+2]["first"]
        if ex > asof: continue
        jobs.update({("stock_day_all",sig), ("stock_day_all",ent), ("stock_day_all",ex),
                     ("institutional",sig), ("margin",sig)})
    def get(job):
        ds,d = job
        path = cache / ds / d[:4] / f"{d}.csv"
        contents = cache_get(path, f"{RAW}/{ds}/{d[:4]}/{d}.csv")
        result = csvmap(contents, ds)
        if not result: raise ValueError(f"No recognized symbols in {ds} {d}")
        return job, result
    results, fails = {}, []
    with ThreadPoolExecutor(max_workers=max(1,min(int(workers),12))) as ex:
        futs={ex.submit(get,j):j for j in sorted(jobs)}
        for done_count, fut in enumerate(as_completed(futs), 1):
            if done_count % 50 == 0 or done_count == len(futs):
                print(f"Archive progress {done_count}/{len(futs)} files", flush=True)
            try:
                key, val = fut.result()
                results[key]=val
            except Exception as err:
                fails.append({"job":futs[fut], "reason":str(err)[:200]})
    return results, fails, len(jobs)


def build_events(weekly: list[dict], data: dict, asof: str) -> pd.DataFrame:
    memory=defaultdict(list)
    records=[]
    for k in range(len(weekly)-2):
        s,entry,ex = weekly[k]["last"], weekly[k+1]["first"], weekly[k+2]["first"]
        if ex > asof: continue
        pp = data.get(("stock_day_all",s))
        pe = data.get(("stock_day_all",entry))
        px = data.get(("stock_day_all",ex))
        inst = data.get(("institutional",s))
        marg = data.get(("margin",s))
        if any(x is None for x in (pp,pe,px,inst,marg)): continue
        benchmark = None
        try:
            benchmark = adjusted_price("0050",ex,px["0050"]["open"]) / adjusted_price("0050",entry,pe["0050"]["open"]) - 1
        except (KeyError,ZeroDivisionError): continue
        for code in STOCKS:
            p0,p1,p2,fi,ma = (pp.get(code),pe.get(code),px.get(code),inst.get(code),marg.get(code))
            if p0 is None or p1 is None or p2 is None or fi is None or ma is None: continue
            if p0["vol"]<=0: continue
            p_sig=adjusted_price(code,s,p0["close"])
            p_entry=adjusted_price(code,entry,p1["open"])
            p_exit=adjusted_price(code,ex,p2["open"])
            if min(p_sig,p_entry,p_exit)<=0: continue
            ret=p_exit/p_entry - 1
            # Preserve extreme real returns instead of silently deleting losing or winning observations.
            # Values above 40% in absolute size will be listed for separate corporate-action audit.
            hist=memory[code]
            mom=p_sig/hist[-4]-1 if len(hist)>=4 else np.nan
            # Keep momentum history based on past signal dates ONLY; current price appended after feature calculation.
            memory[code].append(p_sig)
            records.append({"signal_date":s,"entry_date":entry,"exit_date":ex,"ticker":code,
                  "forward_1w":ret,"forward_excess_0050":ret-benchmark,"0050_forward_1w":benchmark,
                  "foreign":fi["foreign"]/p0["vol"],"trust":fi["trust"]/p0["vol"],
                  "margin":1000*(ma["curr"]-ma["prev"])/p0["vol"],
                  "momentum":mom,"close_signal":p_sig,"volume":p0["vol"]})
    df=pd.DataFrame(records)
    if df.empty: raise ValueError("No complete weekly event data. Examine source coverage.")
    return df.sort_values(["signal_date", "ticker"]).reset_index(drop=True)


def spearman_manual(a: np.ndarray, b: np.ndarray):
    if len(a)<3: return np.nan
    x=pd.Series(a).rank(method="average").to_numpy(dtype=float)
    y=pd.Series(b).rank(method="average").to_numpy(dtype=float)
    if np.std(x)==0 or np.std(y)==0: return np.nan
    return float(np.corrcoef(x,y)[0,1])


def information_coefficients(df: pd.DataFrame, period: str) -> pd.DataFrame:
    sub= df if period=="all" else df[(df.signal_date<"2026-01-01") if period=="development" else (df.signal_date>="2026-01-01")]
    output=[]
    for feat in FEATURES:
        values=[]
        for _,gp in sub.groupby("signal_date"):
            g=gp[[feat,"forward_excess_0050"]].dropna()
            if len(g)<5: continue
            ic=spearman_manual(g[feat].to_numpy(),g["forward_excess_0050"].to_numpy())
            if np.isfinite(ic): values.append(ic)
        arr=np.asarray(values)
        if len(arr)<2: continue
        output.append({"period":period,"feature":feat,"weeks":len(arr),
                       "mean_weekly_IC":round(float(arr.mean()),4),
                       "IC_positive_fraction":round(float((arr>0).mean()),4),
                       "IC_t_stat_descriptive":round(float(arr.mean()/(arr.std(ddof=1)/math.sqrt(len(arr)))),3) if arr.std(ddof=1)>0 else None})
    return pd.DataFrame(output)


def make_weights(df: pd.DataFrame) -> pd.DataFrame:
    valid=[]
    for day,g in df.groupby("signal_date"):
        if len(g)<5 or g[FEATURES].isna().any().any(): continue
        # All ranks are defined at the signal date. Low margin growth is scored favorably.
        g=g.copy()
        for f in FEATURES: g["rank_"+f]=g[f].rank(ascending=(f!="margin"),pct=True)
        g["composite"] = g[["rank_"+f for f in FEATURES]].sum(axis=1)
        for key in ["equal","foreign","trust","margin","momentum","composite"]:
            if key=="equal": ids=set(g.ticker)
            else: ids=set(g.sort_values(key,ascending=(key=="margin")).ticker.head(2))
            for _,r in g.iterrows():
                valid.append({"signal_date":day,"entry_date":r.entry_date,"exit_date":r.exit_date,"ticker":r.ticker,
                     "strategy":key,"target":1/len(ids) if r.ticker in ids else 0,
                     "weekly_return":r.forward_1w,"bench_return":r["0050_forward_1w"]})
        for key,f in [("foreignPositive","foreign"),("trustPositive","trust")]:
            ids=set(g.loc[g[f]>0,"ticker"])
            for _,r in g.iterrows():
                valid.append({"signal_date":day,"entry_date":r.entry_date,"exit_date":r.exit_date,"ticker":r.ticker,
                     "strategy":key,"target":1/len(ids) if (len(ids)>0 and r.ticker in ids) else 0,
                     "weekly_return":r.forward_1w,"bench_return":r["0050_forward_1w"]})
    return pd.DataFrame(valid)


def simulate(weekly: pd.DataFrame, strategy: str, start: str, end: str) -> dict:
    sub=weekly.loc[(weekly.strategy==strategy)&(weekly.signal_date>=start)&(weekly.signal_date<=end)]
    groups=list(sub.groupby("signal_date"))
    equity=peak=1.0; worst=0.0; trades=0; total_traded=0.0; exposures=[]; prev={}; returns=[]
    for _,g in groups:
        tg=dict(zip(g.ticker,g.target))
        dr=dict(zip(g.ticker,g.weekly_return))
        traded=0.0;fee=0.0
        for code in set(prev)|set(tg):
            delta=tg.get(code,0)-prev.get(code,0)
            traded+=abs(delta)
            if delta>0: fee += delta*FEE_BUY
            elif delta<0: fee += (-delta)*FEE_SELL_STOCK
        if traded>1e-9: trades+=1
        total_traded+=traded;equity*=1-fee
        r=sum(w*dr[ticker] for ticker,w in tg.items() if w>0)
        equity*=1+r
        peak=max(peak,equity);worst=min(worst,equity/peak-1)
        prev={code:w*(1+dr[code])/(1+r) for code,w in tg.items() if w>0}
        returns.append(r-fee);exposures.append(sum(tg.values()))
    return _metrics(equity,worst,len(groups),trades,total_traded,exposures,returns)


def benchmark(df: pd.DataFrame, start: str, end: str)->dict:
    x=(df.loc[(df.signal_date>=start)&(df.signal_date<=end),["signal_date","0050_forward_1w"]]
         .drop_duplicates("signal_date").sort_values("signal_date"))
    equity=1-FEE_BUY; peak=1.0;worst=0.0;returns=[]
    for r in x.itertuples():
        equity*=1+r._2
        peak=max(peak,equity);worst=min(worst,equity/peak-1);returns.append(r._2)
    return _metrics(equity,worst,len(x),1,1,[1]*len(x),returns)


def _metrics(eq,worst,n,trades,turnover,exposure,returns):
    if n<2:return {"weeks":n,"error":"insufficient observations"}
    z=np.asarray(returns,dtype=float)
    vol=float(z.std(ddof=1))
    return {"weeks":n,"cumulative_pct":round((eq-1)*100,2),
      "annualized_pct":round((eq**(52/n)-1)*100,2),
      "max_open_to_open_drawdown_pct":round(worst*100,2),
      "sharpe_0pct_cash":round(float(z.mean()/vol*math.sqrt(52)),2) if vol>0 else None,
      "avg_stock_exposure_pct":round(float(np.mean(exposure))*100,1),
      "rebalanced_weeks":trades,"gross_turnover":round(turnover,2)}


def self_test():
    # Parse the actual TWSE column schema using synthetic values, avoiding online dependence.
    price=("Date,Code,Name,TradeVolume,TradeValue,OpeningPrice,HighestPrice,LowestPrice,ClosingPrice,Change,Transaction\n"
           "1151116,2330,台積電,1000000,1000000000,2200,2250,2190,2215,-135,100\n").encode()
    inst=("證券代號,證券名稱,外陸資買進股數(不含外資自營商),外陸資賣出股數(不含外資自營商),外陸資買賣超股數(不含外資自營商),外資自營商買進股數,外資自營商賣出股數,外資自營商買賣超股數,投信買進股數,投信賣出股數,投信買賣超股數\n"
          "2330,台積電,100,200,-100,0,0,0,150,50,100\n").encode()
    margin=("股票代號,股票名稱,融資買進,融資賣出,融資現金償還,融資前日餘額,融資今日餘額\n"
            "2330,台積電,10,20,1,1000,989\n").encode()
    assert csvmap(price,"stock_day_all")["2330"]["close"]==2215
    assert csvmap(inst,"institutional")["2330"]["foreign"]==-100
    assert csvmap(margin,"margin")["2330"]["curr"]==989
    assert adjusted_price("2327","2025-08-13",546)==136.5
    assert adjusted_price("2327","2025-08-25",136.5)==136.5
    assert adjusted_price("0050","2025-06-10",188.65)==47.1625
    assert week_monday("2026-11-13")=="2026-11-09"
    # Keep sorting directional: foreign/trust/momentum are high-is-good; rising margin is low-is-good.
    ex=pd.DataFrame([{"signal_date":"2026-11-06","entry_date":"2026-11-09",
        "exit_date":"2026-11-16","ticker":code,"foreign":float(i),
        "trust":float(i),"margin":float(i),"momentum":float(i),
        "forward_1w":0.01,"0050_forward_1w":0.0}
        for i,code in enumerate(STOCKS)])
    ranked=make_weights(ex)
    def winners(name): return set(ranked.loc[(ranked.strategy==name)&(ranked.target>0),"ticker"])
    assert winners("foreign")==set(STOCKS[-2:]), "foreign ranking inverted"
    assert winners("trust")==set(STOCKS[-2:]), "trust ranking inverted"
    assert winners("momentum")==set(STOCKS[-2:]), "momentum ranking inverted"
    assert winners("margin")==set(STOCKS[:2]), "margin ranking inverted"
    assert winners("composite")==set(STOCKS[-2:]), "composite ranking inverted"
    # Check that portfolio output reflects price changes and transaction costs.
    d=pd.DataFrame([{"signal_date":"2026-11-06","ticker":"2330","strategy":"equal","target":1.,"weekly_return":.05},
                    {"signal_date":"2026-11-13","ticker":"2330","strategy":"equal","target":1.,"weekly_return":-.02}])
    r=simulate(d,"equal","2026-11-01","2026-11-30")
    assert r["weeks"]==2 and r["cumulative_pct"]>2.0
    print("SELF-TEST PASSED: CSV schema, split adjustment, calendar, cash-flow and fee logic")


def main():
    p=argparse.ArgumentParser()
    p.add_argument("--start-year",type=int,default=2024)
    p.add_argument("--end-year",type=int,default=2026)
    p.add_argument("--asof",default="2026-11-16")
    p.add_argument("--workers",type=int,default=6)
    p.add_argument("--cache",default="taiwan_backtest_v3_cache")
    p.add_argument("--out",default="taiwan_backtest_v3_outputs")
    p.add_argument("--refresh-dates",action="store_true")
    p.add_argument("--self-test",action="store_true")
    p.add_argument("--allow-missing",action="store_true",help="Proceed despite incomplete archived daily files (not recommended)")
    args=p.parse_args()
    if args.self_test:
        self_test();return
    assert args.start_year<=args.end_year
    root=Path(args.cache);root.mkdir(parents=True,exist_ok=True)
    dates=[]
    for yr in range(args.start_year,args.end_year+1):
        dates+=list_dates(yr,root,refresh=args.refresh_dates)
    wk=anchors([x for x in dates if x<=args.asof]); print(f"Available dates={len(dates)}; calendar weeks={len(wk)}",flush=True)
    data,errors,jobs=load_archive(wk,root,args.workers,args.asof)
    print(f"Downloaded/loaded {len(data)}/{jobs} daily files; errors={len(errors)}",flush=True)
    if errors: print("First errors:",errors[:5],file=sys.stderr)
    if errors and len(errors)/jobs > 0.01 and not args.allow_missing:
        raise RuntimeError(f"Source coverage failed: {len(errors)}/{jobs} missing files (>1%). Check connection/data archive or specify --allow-missing after audit.")
    frame=build_events(wk,data,args.asof)
    scores=make_weights(frame)
    if scores.empty: raise RuntimeError("No weeks had >= 5 complete stocks plus valid 4-week momentum.")
    # Every strategy and the index benchmark must be evaluated on identical calendar weeks.
    frame=frame.loc[frame.signal_date.isin(set(scores.signal_date))].copy()
    dest=Path(args.out);dest.mkdir(parents=True,exist_ok=True)
    frame.to_csv(dest/"weekly_events.csv",index=False,encoding="utf-8-sig")
    scores.to_csv(dest/"weekly_portfolio_targets.csv",index=False,encoding="utf-8-sig")
    results=[];ic=[]
    for period,a,b in [("all",f"{args.start_year}-01-01",args.asof),
                       ("development",f"{args.start_year}-01-01","2025-12-31"),
                       ("evaluation","2026-01-01",args.asof)]:
        if args.start_year>=2026 and period=="development":continue
        ic.append(information_coefficients(frame,period))
        bm=benchmark(frame,a,b);results.append({"period":period,"strategy":"hold0050",**bm})
        for strat in sorted(scores.strategy.unique()):
            results.append({"period":period,"strategy":strat,**simulate(scores,strat,a,b)})
    perf=pd.DataFrame(results)
    perf.to_csv(dest/"strategy_metrics.csv",index=False,encoding="utf-8-sig")
    pd.concat(ic,ignore_index=True).to_csv(dest/"information_coefficients.csv",index=False,encoding="utf-8-sig")
    manifest={"repository":REPO,"asof":args.asof,"start_year":args.start_year,"end_year":args.end_year,
              "fetched_files":len(data),"required_files":jobs,"failures":errors,
              "event_rows":len(frame),"event_weeks":int(frame.signal_date.nunique()),
              "large_absolute_weekly_moves":frame.loc[frame.forward_1w.abs()>0.4,["signal_date","ticker","forward_1w"]].to_dict(orient="records"),
              "notes":["Only end-of-week as-of signals; next-week first open entry; following-week first open exit",
               "Stock splits adjusted: 0050 2025-06-18, 2327 2025-08-25",
               "Price returns only: no cash dividends, no slippage, cash earns 0%, no interest on idle funds",
               "Six surviving preselected stocks: survivorship and sector-selection bias",
               "Weekly open-to-open drawdown underestimates within-week drawdown",
               "Weekly funding flows use Friday net only, not full trailing five-day net"]}
    (dest/"manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding="utf-8")
    # Publish a small provenance-rich JSON to the existing static MARKET RADAR App.
    # This study is a six-stock weekly factor experiment, NOT the production 45/35/20 ranking.
    summary={
        "schema":1,"status":"completed","generatedAt":pd.Timestamp.utcnow().isoformat(),
        "asOf":args.asof,"study":"V3 corrected weekly multi-factor evaluation",
        "universe":{"stocks":STOCKS,"benchmark":"0050","survivorshipWarning":True},
        "factors":{"foreign":"Friday foreign net shares / Friday volume",
                  "trust":"Friday trust net shares / Friday volume",
                  "margin":"Friday daily margin position delta / volume (lower preferred)",
                  "momentum":"4 prior weekly signal close-price momentum"},
        "periods":{"development":"2024-2025","evaluation":"2026"},
        "method":{"signal":"end-of-week after close","entry":"following week first opening price",
                  "exit":"next week first opening price","cost":"buy 0.1425%; sell 0.4425%",
                  "dividendsIncluded":False,"splitsAdjusted":["0050 2025-06-18","2327 2025-08-25"]},
        "coverage":{"requiredFiles":jobs,"fetchedFiles":len(data),"failures":len(errors),
                    "weeks":int(frame.signal_date.nunique()),"eventRows":len(frame)},
        "strategyMetrics":json.loads(perf.to_json(orient="records")),
        "informationCoefficients":json.loads(pd.concat(ic).to_json(orient="records")),
        "exclusions":["Not the 45/35/20 homepage score",
                      "No historical broker EPS consensus, company news or macro backtesting",
                      "Only six pre-selected surviving stocks; strong sample selection bias",
                      "No cash dividends/slippage and incomplete corporate-action audit",
                      "Research-only and not evidence of out-of-sample predictive accuracy"],
        "dataSource":"https://github.com/joy40217/TWSE-daily"}
    appdata=Path("market-radar/data")
    appdata.mkdir(parents=True,exist_ok=True)
    (appdata/"backtest-longterm.json").write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding="utf-8")
    print("OUTPUT",dest.resolve())
    print(perf.to_string(index=False))
    print(pd.concat(ic).to_string(index=False))

if __name__=="__main__":main()
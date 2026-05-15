# 2013 Ram (5.7L HEMI) — Consolidated Diagnostic Data

**Vehicle:** 2013 Ram 1500, 5.7L HEMI V8 with MDS — PCM odometer **319,774 mi**  
**Capture date:** 2026-05-14 (XTOOL D7, serial D7-027522)  
**Symptoms reported:** loss of power, oil pressure light, small vibration at idle  
**Source:** 6 `.cds` datastream recordings + 3 `.csv` exports pulled from the D7. The two 2004 Dodge captures from the same session are excluded.

> Note: scanner labels some temps "deg C" that are actually °F (coolant ~203, oil ~188) — display quirk.

---

## .cds datastream recordings

### 16:49  Drive loop A  (1455 frames)
`CHRYSLER_1778795375286.cds` — recorded 2026-05-14 16:49:35.434000 — 1455 frames — 8 PIDs

| PID | unit | n | min | max | mean | stdev | first | last | flag |
|-----|------|--:|----:|----:|-----:|------:|------:|-----:|------|
| MAP Vacuum | inHg | 1455 | 1.650 | 23.300 | 15.325 | 5.970 | 20.300 | 18.580 |  |
| TPS 1 Volts | V | 1455 | 0.690 | 2.290 | 0.976 | 0.288 | 0.710 | 0.720 |  |
| TPS 2 Volts | V | 1455 | 2.710 | 4.320 | 4.025 | 0.289 | 4.300 | 4.280 |  |
| Engine Speed | rpm | 1455 | 573.000 | 3847.000 | 1232.323 | 515.063 | 604.000 | 583.000 |  |
| 1/1 O2 Sensor Level |  | 0 |  |  |  |  |  |  | NO-DATA |
| 1/1 Short Term ADAP | % | 1455 | -13.680 | 12.100 | -1.174 | 4.097 | 3.900 | -0.010 |  |
| 2/1 Short Term ADAP | % | 1455 | -11.140 | 12.880 | -0.291 | 4.011 | 1.950 | -1.960 |  |
| Intake Air Temp | deg F | 1455 | 109.400 | 138.200 | 118.018 | 8.921 | 138.200 | 116.600 |  |

### 18:53  Misfire capture  (598 frames)
`DODGE_1778802834193.cds` — recorded 2026-05-14 18:53:54.691000 — 598 frames — 11 PIDs

| PID | unit | n | min | max | mean | stdev | first | last | flag |
|-----|------|--:|----:|----:|-----:|------:|------:|-----:|------|
| Mis-Fire Monitor Status |  | 0 |  |  |  |  |  |  | NO-DATA |
| Mis-Fire Counter-200 REV |  | 598 | 1.000 | 798.000 | 417.393 | 235.312 | 675.000 | 443.000 |  |
| Mis-Fire Counter CAT 200 Rev |  | 598 | 0.000 | 1.000 | 0.033 | 0.180 | 0.000 | 0.000 |  |
| Cylinder 1 FTP Mis-Fire Counter |  | 598 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | FLAT |
| Cylinder 2 FTP Mis-Fire Counter |  | 598 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | FLAT |
| Cylinder 3 FTP Mis-Fire Counter |  | 598 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | FLAT |
| Cylinder 4 FTP Mis-Fire Counter |  | 598 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | FLAT |
| Cylinder 5 FTP Mis-Fire Counter |  | 598 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | FLAT |
| Cylinder 6 FTP Mis-Fire Counter |  | 598 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | FLAT |
| Cylinder 7 FTP Mis-Fire Counter |  | 598 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | FLAT |
| Cylinder 8 FTP Mis-Fire Counter |  | 598 | 0.000 | 1.000 | 0.196 | 0.397 | 0.000 | 0.000 |  |

### 18:59  Full 215-PID stationary capture  (1012 frames)
`DODGE_1778803156684.cds` — recorded 2026-05-14 18:59:16.849000 — 1012 frames — 215 PIDs

| PID | unit | n | min | max | mean | stdev | first | last | flag |
|-----|------|--:|----:|----:|-----:|------:|------:|-----:|------|
| Mis-Fire Monitor Status |  | 0 |  |  |  |  |  |  | NO-DATA |
| Mis-Fire Counter-200 REV |  | 14 | 447.000 | 800.000 | 611.929 | 128.558 | 627.000 | 800.000 |  |
| Mis-Fire Counter CAT 200 Rev |  | 14 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | FLAT |
| Cylinder 1 FTP Mis-Fire Counter |  | 14 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | FLAT |
| Cylinder 2 FTP Mis-Fire Counter |  | 14 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | FLAT |
| Cylinder 3 FTP Mis-Fire Counter |  | 14 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | FLAT |
| Cylinder 4 FTP Mis-Fire Counter |  | 14 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | FLAT |
| Cylinder 5 FTP Mis-Fire Counter |  | 14 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | FLAT |
| Cylinder 6 FTP Mis-Fire Counter |  | 14 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | FLAT |
| Cylinder 7 FTP Mis-Fire Counter |  | 14 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | FLAT |
| Cylinder 8 FTP Mis-Fire Counter |  | 14 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | FLAT |
| SKIM VTA Invalid Key Received Fault Posted |  | 0 |  |  |  |  |  |  | NO-DATA |
| NGC Should Shut Off Fuel |  | 0 |  |  |  |  |  |  | NO-DATA |
| SKIM/VTA Has Completed |  | 0 |  |  |  |  |  |  | NO-DATA |
| IGN OFF RUN START SW |  | 0 |  |  |  |  |  |  | NO-DATA |
| IGN RUN START SW |  | 0 |  |  |  |  |  |  | NO-DATA |
| IGN START SW |  | 0 |  |  |  |  |  |  | NO-DATA |
| Ignition Start Switch Filtered Switch State |  | 0 |  |  |  |  |  |  | NO-DATA |
| MAP Vacuum | inHg | 176 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | FLAT |
| Map Volts | V | 176 | 4.390 | 4.400 | 4.390 | 0.001 | 4.390 | 4.390 | FLAT |
| Barometric Pressure | inHg | 167 | 29.260 | 29.260 | 29.260 | 0.000 | 29.260 | 29.260 | FLAT |
| APP 1 Volts | V | 167 | 0.430 | 0.430 | 0.430 | 0.000 | 0.430 | 0.430 | FLAT |
| APP 2 Volts | V | 166 | 0.000 | 0.220 | 0.216 | 0.024 | 0.210 | 0.220 |  |
| TPS 1 Minimum Volts | V | 165 | 0.510 | 0.510 | 0.510 | 0.000 | 0.510 | 0.510 | FLAT |
| TPS 1 Volts | V | 0 |  |  |  |  |  |  | NO-DATA |
| TPS 2 Minimum Volts | V | 0 |  |  |  |  |  |  | NO-DATA |
| TPS 2 Volts | V | 15 | 4.290 | 4.290 | 4.290 | 0.000 | 4.290 | 4.290 | FLAT |
| Throttle Blade Position | % | 124 | 4.090 | 8.580 | 8.036 | 1.464 | 8.550 | 4.090 |  |
| ETC Directional Duty Cycle | % | 124 | -19.420 | 0.000 | -2.349 | 6.333 | 0.000 | -19.420 |  |
| Engine Speed | rpm | 944 | 0.000 | 3944.000 | 1060.165 | 586.445 | 0.000 | 611.000 |  |
| Target Idle Speed | rpm | 124 | 624.000 | 1104.000 | 1045.935 | 156.523 | 1104.000 | 624.000 |  |
| Time From Start Run | ms | 124 | 0.000 | 83.870 | 10.146 | 27.349 | 0.000 | 83.870 |  |
| Time Fuel System in Run Mode | ms | 124 | 0.000 | 81.920 | 9.910 | 26.713 | 0.000 | 81.920 |  |
| Ignition Off Time | minutes | 124 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | FLAT |
| Engine Runtime | ms | 118 | 0.000 | 88.350 | 10.442 | 28.462 | 0.000 | 88.350 |  |
| Purge Duty Cycle | % | 118 | 0.000 | 30.430 | 3.590 | 9.785 | 0.000 | 30.300 |  |
| Desired Purge Current | mA | 118 | 0.000 | 192.470 | 22.794 | 62.127 | 0.000 | 192.470 |  |
| Actual Purge Current | mA | 117 | 0.000 | 195.400 | 23.206 | 62.947 | 0.000 | 194.420 |  |
| Purge AirFlow | g/s | 113 | 0.000 | 0.160 | 0.020 | 0.053 | 0.000 | 0.160 |  |
| Purge Mode |  | 0 |  |  |  |  |  |  | NO-DATA |
| Purge Vapor Ratio |  | 113 | 0.100 | 0.270 | 0.249 | 0.056 | 0.270 | 0.100 |  |
| Purge Adaptive |  | 113 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | FLAT |
| Actual Torque | Nm | 112 | -1.510 | 434.920 | 391.369 | 129.657 | 434.920 | -1.510 |  |
| ETC Starter Inhibit | mile | 112 | 315351.040 | 315351.040 | 315351.040 | 0.000 | 315351.040 | 315351.040 | FLAT |
| Injector Pulse Width Cylinder 1 | us | 932 | 0.000 | 10832.000 | 2761.056 | 2408.811 | 0.000 | 2056.000 |  |
| Injector Pulse Width Cylinder 2 | us | 931 | 0.000 | 10248.000 | 2677.319 | 2347.443 | 0.000 | 2000.000 |  |
| Injector Pulse Width Cylinder 3 | us | 111 | 0.000 | 1840.000 | 150.631 | 456.002 | 0.000 | 1536.000 |  |
| Injector Pulse Width Cylinder 4 | us | 111 | 0.000 | 1896.000 | 148.252 | 448.958 | 0.000 | 1472.000 |  |
| Injector Pulse Width Cylinder 5 | us | 111 | 0.000 | 1608.000 | 132.036 | 420.255 | 0.000 | 1480.000 |  |
| Injector Pulse Width Cylinder 6 | us | 5 | 1184.000 | 6760.000 | 2460.800 | 2152.613 | 6760.000 | 1384.000 |  |
| Injector Pulse Width Cylinder 7 | us | 826 | 0.000 | 10992.000 | 2916.320 | 2189.649 | 1416.000 | 1952.000 |  |
| Injector Pulse Width Cylinder 8 | us | 826 | 0.000 | 10800.000 | 3009.782 | 2283.501 | 1424.000 | 2056.000 |  |
| Cranking Injector Pulse Width | us | 6 | 7064.000 | 7064.000 | 7064.000 | 0.000 | 7064.000 | 7064.000 | FLAT |
| 1/1 O2 Sensor Level |  | 0 |  |  |  |  |  |  | NO-DATA |
| 2/1 O2 Sensor Level |  | 0 |  |  |  |  |  |  | NO-DATA |
| 1/1 O2 Goal(0-1) | V | 6 | 0.670 | 0.670 | 0.670 | 0.000 | 0.670 | 0.670 | FLAT |
| 2/1 O2 Goal(0-1) | V | 110 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | FLAT |
| 1/1 O2 Volts(0-1) | V | 110 | 0.960 | 0.960 | 0.960 | 0.000 | 0.960 | 0.960 | FLAT |
| 1/1 O2 Sensor Volts | V | 110 | 3.470 | 3.470 | 3.470 | 0.000 | 3.470 | 3.470 | FLAT |
| 1/2 O2 Volts(0-1) | V | 110 | 0.820 | 0.820 | 0.820 | 0.000 | 0.820 | 0.820 | FLAT |
| 1/2 O2 Sensor Volts | V | 110 | 3.340 | 3.340 | 3.340 | 0.000 | 3.340 | 3.340 | FLAT |
| 2/1 O2 Volts(0-1) | V | 110 | 1.080 | 1.080 | 1.080 | 0.000 | 1.080 | 1.080 | FLAT |
| 2/1 O2 Sensor Volts | V | 0 |  |  |  |  |  |  | NO-DATA |
| 2/2 O2 Volts(0-1) | V | 0 |  |  |  |  |  |  | NO-DATA |
| 2/2 O2 Sensor Volts | V | 0 |  |  |  |  |  |  | NO-DATA |
| 1/1 O2 Fuel Feedback |  | 0 |  |  |  |  |  |  | NO-DATA |
| 2/1 O2 Fuel Feedback |  | 0 |  |  |  |  |  |  | NO-DATA |
| 1/1 Pulse Width O2 Heater | % | 109 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | FLAT |
| 1/2 Pulse Width O2 Heater | % | 109 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | FLAT |
| 2/1 Pulse Width O2 Heater | % | 109 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | FLAT |
| 2/2 Pulse Width O2 Heater | % | 109 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | FLAT |
| 1/1 O2 Heater Temp | deg C | 108 | 1122.800 | 1122.800 | 1122.800 | 0.000 | 1122.800 | 1122.800 | FLAT |
| 1/2 O2 Heater Temp | deg C | 108 | 1086.800 | 1086.800 | 1086.800 | 0.000 | 1086.800 | 1086.800 | FLAT |
| 2/1 O2 Heater Temp | deg C | 0 |  |  |  |  |  |  | NO-DATA |
| 2/2 O2 Heater Temp | deg C | 0 |  |  |  |  |  |  | NO-DATA |
| 1/1 Short Term ADAP | % | 0 |  |  |  |  |  |  | NO-DATA |
| 2/1 Short Term ADAP | % | 0 |  |  |  |  |  |  | NO-DATA |
| 1/1 Long Term ADAP | % | 107 | 8.200 | 8.200 | 8.200 | 0.000 | 8.200 | 8.200 | FLAT |
| 2/1 Long Term ADAP | % | 107 | 8.790 | 8.790 | 8.790 | 0.000 | 8.790 | 8.790 | FLAT |
| Closed Loop Timer | ms | 107 | 10.240 | 10.240 | 10.240 | 0.000 | 10.240 | 10.240 | FLAT |
| Current ADAP Cell ID |  | 107 | 24.000 | 24.000 | 24.000 | 0.000 | 24.000 | 24.000 | FLAT |
| Engine Coolant Temp | deg C | 107 | 203.000 | 203.000 | 203.000 | 0.000 | 203.000 | 203.000 | FLAT |
| Engine Coolant Temp Volt | V | 107 | 0.850 | 0.850 | 0.850 | 0.000 | 0.850 | 0.850 | FLAT |
| Intake Air Temp | deg C | 105 | 120.200 | 120.200 | 120.200 | 0.000 | 120.200 | 120.200 | FLAT |
| Intake Air Temp Volt | V | 105 | 2.420 | 2.420 | 2.420 | 0.000 | 2.420 | 2.420 | FLAT |
| Ambient Temp | deg C | 105 | 71.600 | 71.600 | 71.600 | 0.000 | 71.600 | 71.600 | FLAT |
| Ambient Temp Voltage | V | 105 | 2.630 | 2.630 | 2.630 | 0.000 | 2.630 | 2.630 | FLAT |
| Fuel Level Percent | % | 105 | 9.000 | 9.000 | 9.000 | 0.000 | 9.000 | 9.000 | FLAT |
| Fuel Tank Vapor Volume | gal | 105 | 26.880 | 26.880 | 26.880 | 0.000 | 26.880 | 26.880 | FLAT |
| Fuel Tank Size | gal | 104 | 26.000 | 26.000 | 26.000 | 0.000 | 26.000 | 26.000 | FLAT |
| Fuel Level Sensor/#1 Volts | V | 104 | 3.800 | 3.800 | 3.800 | 0.000 | 3.800 | 3.800 | FLAT |
| CAT Modeled Temp | deg C | 104 | 1322.600 | 1322.600 | 1322.600 | 0.000 | 1322.600 | 1322.600 | FLAT |
| Oil Pressure | kPa | 104 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | FLAT |
| VVT Oil Pressure | kPa | 104 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | FLAT |
| Engine Oil Temperature | deg C | 102 | 188.600 | 190.400 | 188.618 | 0.177 | 190.400 | 188.600 | FLAT |
| Oil Pressure Sensor Voltage | V | 102 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | FLAT |
| Voltage Sense | V | 102 | 12.270 | 12.270 | 12.270 | 0.000 | 12.270 | 12.270 | FLAT |
| VVT Oil Temp | deg C | 102 | 188.600 | 190.400 | 188.618 | 0.177 | 190.400 | 188.600 | FLAT |
| Target Charging Voltage | V | 100 | 13.770 | 13.770 | 13.770 | 0.000 | 13.770 | 13.770 | FLAT |
| Generator Duty Cycle | %DC | 100 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | FLAT |
| Mass Airflow | g/s | 920 | 1.960 | 176.210 | 19.981 | 22.484 | 2.890 | 6.940 |  |
| Knock Sensor 1 Volts | V | 920 | 0.000 | 3.640 | 0.320 | 0.213 | 0.000 | 0.230 |  |
| Knock Sensor 2 Volts | V | 920 | 0.000 | 4.300 | 0.348 | 0.311 | 0.000 | 0.230 |  |
| ST Knock Retard | Degree | 98 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | FLAT |
| Base Spark | Degree | 98 | -64.000 | -64.000 | -64.000 | 0.000 | -64.000 | -64.000 | FLAT |
| Spark Advance | EngineDeg | 91 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | FLAT |
| ESIM Switch |  | 0 |  |  |  |  |  |  | NO-DATA |
| AC Hi-Side Voltage | V | 91 | 1.220 | 1.240 | 1.239 | 0.004 | 1.220 | 1.240 |  |
| AC Hi-Side Pressure | kPa | 89 | 113.680 | 113.680 | 113.680 | 0.000 | 113.680 | 113.680 | FLAT |
| PCM Odometer | mile | 89 | 319774.720 | 319774.720 | 319774.720 | 0.000 | 319774.720 | 319774.720 | FLAT |
| Vehicle Speed | mph | 89 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | FLAT |
| Cam Sync State |  | 0 |  |  |  |  |  |  | NO-DATA |
| Crank Signal Missing |  | 0 |  |  |  |  |  |  | NO-DATA |
| Crank Sync State |  | 0 |  |  |  |  |  |  | NO-DATA |
| Crank System Fault and in Limp-Home Mode |  | 0 |  |  |  |  |  |  | NO-DATA |
| Exhaust Cam 1/Crank Difference | EngineDeg | 87 | -0.900 | -0.800 | -0.828 | 0.045 | -0.900 | -0.800 |  |
| Exhaust Cam 1 Duty Cycle | %DC | 87 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | FLAT |
| Exhaust Cam 1 Desired Position | EngineDeg | 71 | 127.800 | 127.800 | 127.800 | 0.000 | 127.800 | 127.800 | FLAT |
| Exhaust Cam 1 Actual Position | EngineDeg | 71 | 127.600 | 127.700 | 127.611 | 0.032 | 127.700 | 127.600 | FLAT |
| Brake Switch Filtered Switch State |  | 0 |  |  |  |  |  |  | NO-DATA |
| Brake Switch 2 Filtered Switch State |  | 0 |  |  |  |  |  |  | NO-DATA |
| Park Neutral Switch Filtered Switch State |  | 0 |  |  |  |  |  |  | NO-DATA |
| AC Select Switch Filtered Switch State |  | 0 |  |  |  |  |  |  | NO-DATA |
| AC Request Switch Filtered Switch State |  | 0 |  |  |  |  |  |  | NO-DATA |
| AC Clutch  RLY DES State |  | 0 |  |  |  |  |  |  | NO-DATA |
| Lo Spd Fan Rly Des State |  | 0 |  |  |  |  |  |  | NO-DATA |
| Hi Spd Fan Des State |  | 0 |  |  |  |  |  |  | NO-DATA |
| ASD Sense Switch Filtered Switch State |  | 0 |  |  |  |  |  |  | NO-DATA |
| ASD Relay DES State |  | 0 |  |  |  |  |  |  | NO-DATA |
| SRV Output State |  | 0 |  |  |  |  |  |  | NO-DATA |
| SRV PWM Feedback | % | 55 | 44.000 | 44.000 | 44.000 | 0.000 | 44.000 | 44.000 | FLAT |
| Fuel Pump  RLY DES State |  | 0 |  |  |  |  |  |  | NO-DATA |
| Desired Malfunction Lamp |  | 0 |  |  |  |  |  |  | NO-DATA |
| MDS Has Been Activated |  | 0 |  |  |  |  |  |  | NO-DATA |
| MDS In V4 State |  | 0 |  |  |  |  |  |  | NO-DATA |
| MDS Status |  | 0 |  |  |  |  |  |  | NO-DATA |
| MDS Transition Status |  | 0 |  |  |  |  |  |  | NO-DATA |
| 4 To 8 Transition or Torque Reserve Requested |  | 0 |  |  |  |  |  |  | NO-DATA |
| MDS Enabling Conditions Have Been Met |  | 0 |  |  |  |  |  |  | NO-DATA |
| MDS Solenoid/#1(Cyl/#1)Status |  | 0 |  |  |  |  |  |  | NO-DATA |
| MDS Solenoid/#2(Cyl/#4)Status |  | 0 |  |  |  |  |  |  | NO-DATA |
| MDS Solenoid/#3(Cyl/#6)Status |  | 0 |  |  |  |  |  |  | NO-DATA |
| MDS Solenoid/#4(Cyl/#7)Status |  | 0 |  |  |  |  |  |  | NO-DATA |
| EVP ACTIVATIONS | count | 45 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | FLAT |
| EVP COOL DOWN TIME | ms | 45 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | FLAT |
| S/C Set Speed | mph | 45 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | FLAT |
| S/C Switch Voltage | V | 45 | 1.800 | 1.820 | 1.819 | 0.005 | 1.800 | 1.820 |  |
| S/C Switch Voltage 2 | V | 45 | 2.270 | 2.410 | 2.386 | 0.023 | 2.270 | 2.390 |  |
| Cruise Lamp Status |  | 0 |  |  |  |  |  |  | NO-DATA |
| S/C Working Status |  | 0 |  |  |  |  |  |  | NO-DATA |
| S/C Denied Status |  | 0 |  |  |  |  |  |  | NO-DATA |
| S/C Disenable Reason |  | 0 |  |  |  |  |  |  | NO-DATA |
| S/C Disengage Reason |  | 0 |  |  |  |  |  |  | NO-DATA |
| S/C Switch State 1 |  | 0 |  |  |  |  |  |  | NO-DATA |
| S/C Switch State 2 |  | 0 |  |  |  |  |  |  | NO-DATA |
| Limp-in Status |  | 0 |  |  |  |  |  |  | NO-DATA |
| Turbine Speed | rpm | 41 | 634.000 | 664.000 | 636.415 | 6.970 | 649.000 | 634.000 |  |
| Output Speed | rpm | 41 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | FLAT |
| Torque Converter Slip | rpm | 41 | 11.000 | 18.000 | 17.220 | 2.042 | 11.000 | 18.000 |  |
| Trans Oil Temperature | deg F | 40 | 135.020 | 135.020 | 135.020 | 0.000 | 135.020 | 135.020 | FLAT |
| Calculate Trans Oil Temp |  | 0 |  |  |  |  |  |  | NO-DATA |
| Trans Temperature Voltage | V | 35 | 2.020 | 2.020 | 2.020 | 0.000 | 2.020 | 2.020 | FLAT |
| LR Pressure Switch |  | 0 |  |  |  |  |  |  | NO-DATA |
| 2C Pressure Switch |  | 0 |  |  |  |  |  |  | NO-DATA |
| 4C Pressure Switch |  | 0 |  |  |  |  |  |  | NO-DATA |
| UD Pressure Switch |  | 0 |  |  |  |  |  |  | NO-DATA |
| OD Pressure Switch |  | 0 |  |  |  |  |  |  | NO-DATA |
| Pressure Switch Error Counter |  | 32 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | FLAT |
| Tow/Haul/OD Switch |  | 0 |  |  |  |  |  |  | NO-DATA |
| Autostick Upshift |  | 0 |  |  |  |  |  |  | NO-DATA |
| Autostick Downshift |  | 0 |  |  |  |  |  |  | NO-DATA |
| Autostick Position |  | 0 |  |  |  |  |  |  | NO-DATA |
| PRNDL Display Request |  | 0 |  |  |  |  |  |  | NO-DATA |
| T41/C1 Switch |  | 0 |  |  |  |  |  |  | NO-DATA |
| T42/C2 Switch |  | 0 |  |  |  |  |  |  | NO-DATA |
| T3/C3 Switch |  | 0 |  |  |  |  |  |  | NO-DATA |
| T1/C4 Switch |  | 0 |  |  |  |  |  |  | NO-DATA |
| Line Pressure Sensor | V | 30 | 0.980 | 1.000 | 0.981 | 0.004 | 1.000 | 0.980 |  |
| T2/C5 Switch |  | 0 |  |  |  |  |  |  | NO-DATA |
| Actual Line Pressure 1 | psi | 30 | 50.000 | 50.000 | 50.000 | 0.000 | 50.000 | 50.000 | FLAT |
| Desired Line Pressure | psi | 30 | 50.000 | 50.000 | 50.000 | 0.000 | 50.000 | 50.000 | FLAT |
| Line Pressure Duty-Cycle(RFE) | % | 28 | 28.240 | 28.240 | 28.240 | 0.000 | 28.240 | 28.240 | FLAT |
| 2C Clutch Fill Volume Index |  | 28 | 34.000 | 34.000 | 34.000 | 0.000 | 34.000 | 34.000 | FLAT |
| LR Clutch Fill Volume Index |  | 28 | 79.000 | 79.000 | 79.000 | 0.000 | 79.000 | 79.000 | FLAT |
| Alternate 2C Clutch Fill Volume Index |  | 28 | 52.000 | 52.000 | 52.000 | 0.000 | 52.000 | 52.000 | FLAT |
| 4C Clutch Fill Volume Index |  | 27 | 39.000 | 39.000 | 39.000 | 0.000 | 39.000 | 39.000 | FLAT |
| UD Clutch Fill Volume Index |  | 27 | 35.000 | 35.000 | 35.000 | 0.000 | 35.000 | 35.000 | FLAT |
| 1st N-D UD Clutch Fill Volume Index |  | 27 | 82.000 | 82.000 | 82.000 | 0.000 | 82.000 | 82.000 | FLAT |
| Norm N-D UD Clutch Fill Volume Index |  | 27 | 53.000 | 53.000 | 53.000 | 0.000 | 53.000 | 53.000 | FLAT |
| OD Clutch Fill Volume Index |  | 27 | 59.000 | 59.000 | 59.000 | 0.000 | 59.000 | 59.000 | FLAT |
| 1st 2-3 OD Clutch Fill Volume Index |  | 0 |  |  |  |  |  |  | NO-DATA |
| Present Gear |  | 0 |  |  |  |  |  |  | NO-DATA |
| Present Gear TCC State |  | 0 |  |  |  |  |  |  | NO-DATA |
| Target Gear |  | 0 |  |  |  |  |  |  | NO-DATA |
| Target Gear TCC State |  | 0 |  |  |  |  |  |  | NO-DATA |
| PRNDL Code(RFE) |  | 0 |  |  |  |  |  |  | NO-DATA |
| LR Clutch |  | 0 |  |  |  |  |  |  | NO-DATA |
| 2C Clutch |  | 0 |  |  |  |  |  |  | NO-DATA |
| OD Clutch |  | 0 |  |  |  |  |  |  | NO-DATA |
| 4C Clutch |  | 0 |  |  |  |  |  |  | NO-DATA |
| UD Clutch |  | 0 |  |  |  |  |  |  | NO-DATA |
| Current/Last Shift Performed |  | 0 |  |  |  |  |  |  | NO-DATA |
| Fuel Tank Pressure | Pa | 25 | -2.370 | -2.370 | -2.370 | 0.000 | -2.370 | -2.370 | FLAT |
| CNG Rail Temperature | deg C | 25 | -83.200 | -83.200 | -83.200 | 0.000 | -83.200 | -83.200 | FLAT |
| CNG Tank Pressure | MPa | 25 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | FLAT |
| CNG Tank Level Percent | % | 25 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | FLAT |
| CNG Fuel Volume Used | gal | 25 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | FLAT |
| CNG Tank Pressure Volts | V | 0 |  |  |  |  |  |  | NO-DATA |
| Gasoline/CNG Switch State |  | 0 |  |  |  |  |  |  | NO-DATA |
| CNG Transition in Progress |  | 0 |  |  |  |  |  |  | NO-DATA |
| Variable Speed Fuel Pump Volts | V | 24 | 2.800 | 2.820 | 2.818 | 0.006 | 2.800 | 2.820 |  |
| Variable Speed Fuel Pump Actual Rail Pressure | kPa | 24 | 57.790 | 58.030 | 57.805 | 0.053 | 57.910 | 57.790 | FLAT |
| Variable Speed Fuel Pump Duty Cycle | %DC | 24 | 67.850 | 67.930 | 67.899 | 0.012 | 67.930 | 67.900 | FLAT |
| Variable Speed Fuel Pump Desired Rail Pressure | kPa | 24 | 58.000 | 58.000 | 58.000 | 0.000 | 58.000 | 58.000 | FLAT |
| STARTER_CNTRL_AUTO_RESTART_CNTR | count | 24 | 40448.000 | 40448.000 | 40448.000 | 0.000 | 40448.000 | 40448.000 | FLAT |

### 19:16  Injector + knock capture  (78 frames)
`DODGE_1778804187496.cds` — recorded 2026-05-14 19:16:27.629000 — 78 frames — 8 PIDs

| PID | unit | n | min | max | mean | stdev | first | last | flag |
|-----|------|--:|----:|----:|-----:|------:|------:|-----:|------|
| Engine Speed | rpm | 78 | 581.000 | 3246.000 | 1497.115 | 715.854 | 657.000 | 601.000 |  |
| Injector Pulse Width Cylinder 1 | us | 78 | 592.000 | 8400.000 | 1596.615 | 1486.832 | 1272.000 | 1448.000 |  |
| Injector Pulse Width Cylinder 2 | us | 78 | 568.000 | 8696.000 | 1522.462 | 1416.556 | 1280.000 | 1368.000 |  |
| Injector Pulse Width Cylinder 7 | us | 78 | 512.000 | 8616.000 | 1485.026 | 1353.209 | 1216.000 | 1384.000 |  |
| Injector Pulse Width Cylinder 8 | us | 78 | 552.000 | 8504.000 | 1566.051 | 1399.569 | 1304.000 | 1416.000 |  |
| Mass Airflow | g/s | 78 | 3.940 | 85.200 | 13.946 | 12.861 | 5.180 | 5.160 |  |
| Knock Sensor 1 Volts | V | 78 | 0.220 | 0.960 | 0.354 | 0.122 | 0.240 | 0.260 |  |
| Knock Sensor 2 Volts | V | 78 | 0.220 | 0.800 | 0.341 | 0.128 | 0.220 | 0.230 |  |

### 19:21  Drive loop B  (941 frames)
`DODGE_1778804467376.cds` — recorded 2026-05-14 19:21:07.436000 — 941 frames — 8 PIDs

| PID | unit | n | min | max | mean | stdev | first | last | flag |
|-----|------|--:|----:|----:|-----:|------:|------:|-----:|------|
| MAP Vacuum | inHg | 941 | 1.420 | 23.720 | 17.150 | 5.323 | 20.530 | 20.830 |  |
| TPS 1 Volts | V | 941 | 0.690 | 2.390 | 0.929 | 0.283 | 0.700 | 0.690 |  |
| TPS 2 Volts | V | 941 | 2.600 | 4.310 | 4.072 | 0.285 | 4.300 | 4.310 |  |
| ETC Directional Duty Cycle | % | 941 | -25.370 | 31.530 | -2.301 | 13.987 | -14.030 | -14.520 |  |
| Engine Speed | rpm | 941 | 546.000 | 4000.000 | 1166.200 | 472.651 | 591.000 | 597.000 |  |
| 1/1 Short Term ADAP | % | 941 | -12.110 | 21.090 | 0.499 | 4.695 | -1.370 | -1.180 |  |
| 2/1 Long Term ADAP | % | 941 | 0.000 | 16.410 | 6.601 | 4.988 | 8.790 | 8.790 |  |
| Oil Pressure | psi | 941 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | FLAT |

### 19:26  Drive loop C - short  (38 frames)
`DODGE_1778804776872.cds` — recorded 2026-05-14 19:26:17.018000 — 38 frames — 8 PIDs

| PID | unit | n | min | max | mean | stdev | first | last | flag |
|-----|------|--:|----:|----:|-----:|------:|------:|-----:|------|
| MAP Vacuum | inHg | 38 | 8.320 | 23.360 | 20.682 | 3.328 | 20.650 | 22.540 |  |
| TPS 1 Volts | V | 38 | 0.690 | 1.520 | 0.798 | 0.151 | 0.690 | 0.750 |  |
| TPS 2 Volts | V | 38 | 3.560 | 4.310 | 4.200 | 0.150 | 4.310 | 4.260 |  |
| ETC Directional Duty Cycle | % | 38 | -31.880 | 24.770 | -10.259 | 12.238 | -13.180 | -13.240 |  |
| Engine Speed | rpm | 38 | 574.000 | 2259.000 | 1257.395 | 565.721 | 585.000 | 868.000 |  |
| 1/1 Short Term ADAP | % | 38 | -11.140 | 6.440 | -2.324 | 4.509 | -2.350 | 6.440 |  |
| 2/1 Long Term ADAP | % | 38 | 5.470 | 16.410 | 9.016 | 1.893 | 8.790 | 8.790 |  |
| Oil Pressure | psi | 38 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | FLAT |

---

## .csv exports (with real millisecond timestamps)

### 16:54  LONG drive recording  (~44 min, real ms timestamps)
`CHRYSLER_1778795669272.csv` — 26411 samples — span 2625.1 s

| PID | unit | n | min | max | mean | stdev | first | last | flag |
|-----|------|--:|----:|----:|-----:|------:|------:|-----:|------|
| Time | ms | 26411 | 58700.000 | 2683848.000 | 1385877.192 | 753041.929 | 58700.000 | 2683848.000 |  |
| MAP Vacuum | inHg | 26401 | 0.000 | 22.660 | 2.086 | 6.104 | 18.580 | 0.000 |  |
| TPS 1 Volts | V | 26402 | 0.510 | 1.480 | 0.924 | 0.056 | 0.720 | 0.940 |  |
| TPS 2 Volts | V | 26402 | 3.490 | 4.490 | 4.076 | 0.056 | 4.280 | 4.060 |  |
| Engine Speed | rpm | 26402 | 0.000 | 639.000 | 42.831 | 152.191 | 584.000 | 0.000 |  |
| 1/1 O2 Sensor Level | N/A | 0 |  |  |  |  |  |  | NO-DATA |
| 1/1 Short Term ADAP | % | 26402 | -3.720 | 2.340 | -0.095 | 0.463 | -1.960 | -0.010 |  |
| 2/1 Short Term ADAP | % | 26403 | -2.740 | 2.920 | -0.046 | 0.369 | 0.580 | -0.010 |  |
| Intake Air Temp | deg F | 26403 | 118.400 | 145.400 | 144.062 | 4.505 | 118.400 | 145.400 |  |

### 16:54  Drive loop A - CSV export  (real ms timestamps)
`boss1_1778795654587.csv` — 132 samples — span 13.1 s

| PID | unit | n | min | max | mean | stdev | first | last | flag |
|-----|------|--:|----:|----:|-----:|------:|------:|-----:|------|
| Time | ms | 132 | 33744.000 | 46842.000 | 40176.530 | 3774.166 | 33744.000 | 46842.000 |  |
| MAP Vacuum | inHg | 132 | 16.810 | 21.830 | 20.024 | 1.510 | 18.470 | 18.700 |  |
| TPS 1 Volts | V | 132 | 0.690 | 1.000 | 0.757 | 0.086 | 0.780 | 0.720 |  |
| TPS 2 Volts | V | 132 | 4.000 | 4.310 | 4.246 | 0.087 | 4.230 | 4.280 |  |
| Engine Speed | rpm | 132 | 588.000 | 1655.000 | 852.856 | 301.874 | 780.000 | 588.000 |  |
| 1/1 O2 Sensor Level | N/A | 0 |  |  |  |  |  |  | NO-DATA |
| 1/1 Short Term ADAP | % | 132 | -12.310 | 9.170 | -1.637 | 4.513 | -2.150 | -2.550 |  |
| 2/1 Short Term ADAP | % | 132 | -11.140 | 9.370 | -0.974 | 5.087 | 1.750 | 0.770 |  |
| Intake Air Temp | deg F | 132 | 109.400 | 111.200 | 110.382 | 0.896 | 109.400 | 111.200 |  |

### 19:16  Injector/knock clip  (~3 s, real ms timestamps)
`DODGE_1778804213097_1778804231946.csv` — 52 samples — span 3.0 s

| PID | unit | n | min | max | mean | stdev | first | last | flag |
|-----|------|--:|----:|----:|-----:|------:|------:|-----:|------|
| Time | ms | 52 | 120332.000 | 123300.000 | 121820.615 | 869.888 | 120332.000 | 123300.000 |  |
| Engine Speed | rpm | 52 | 577.000 | 1970.000 | 1105.231 | 464.039 | 582.000 | 617.000 |  |
| Injector Pulse Width Cylinder 1 | us | 52 | 632.000 | 6824.000 | 1528.769 | 1175.151 | 1456.000 | 1352.000 |  |
| Injector Pulse Width Cylinder 2 | us | 52 | 624.000 | 6240.000 | 1517.538 | 1172.691 | 1352.000 | 1256.000 |  |
| Injector Pulse Width Cylinder 7 | us | 52 | 624.000 | 5032.000 | 1467.846 | 993.506 | 1392.000 | 1280.000 |  |
| Injector Pulse Width Cylinder 8 | us | 52 | 632.000 | 4560.000 | 1561.846 | 1040.281 | 1384.000 | 1264.000 |  |
| Mass Airflow | g/s | 52 | 4.430 | 62.200 | 10.202 | 10.843 | 5.060 | 4.740 |  |
| Knock Sensor 1 Volts | V | 52 | 0.260 | 0.260 | 0.260 | 0.000 | 0.260 | 0.260 | FLAT |
| Knock Sensor 2 Volts | V | 52 | 0.230 | 0.230 | 0.230 | 0.000 | 0.230 | 0.230 | FLAT |

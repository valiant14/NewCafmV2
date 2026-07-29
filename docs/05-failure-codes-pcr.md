# 5. Failure Codes and the Problem–Cause–Remedy Framework

**SEDER CAFM · Document 5 of 6 · prepared in response to DAB review Section A.5**

Scope: the failure code library as it currently stands, the PCR framework it is meant to support, and what
must be authored before that framework can operate.

---

## 5.1 Status of this document — read first

> **The failure library in SEDER CAFM contains no Cause codes and no Remedy codes. Not a partial set — none.**
>
> Every one of its rows carries a Failure Class and a Problem Code. The four columns that hold the Cause and
> Remedy halves of the framework are present in the file and are **empty in every row**. The audit in 5.3
> shows this precisely.
>
> The consequence is that the CAFM system today supports **P**, not **PCR**. The application is already built
> for the full framework — it prompts for Cause and Remedy whenever the library offers them for a chosen
> problem — so no software change is needed. What is missing is the content, and content of this kind is
> engineering judgement that must come from SEDER's maintenance team. It has not been invented here.
>
> Sections 5.4 onwards set out the framework and worked examples so that authoring can begin.

---

## 5.2 What PCR is for

A failure record answers three questions, and each is used by a different person:

| Element | Question | Recorded by | Used for |
|---|---|---|---|
| **Problem** | What was reported or observed? | The requester or the technician on arrival | Trend analysis — what keeps going wrong |
| **Cause** | Why did it happen? | The technician, after diagnosis | Reliability engineering — root cause, repeat failures, design faults |
| **Remedy** | What was done about it? | The technician, on completion | Cost and method analysis — what actually fixes it |

Capturing only the Problem gives a list of symptoms. It cannot answer *why* an asset type keeps failing or
*which* intervention works, which is the entire purpose of collecting failure data. That is what the missing
two thirds cost.

Failure classification is required on **CM work orders only** — see Document 1, section 1.4. A planned
maintenance job has no failure to classify.

---

## 5.3 The library as it stands

<!-- generated:failure-summary -->

| Measure | Value |
| --- | --- |
| Rows in the failure library | 2549 |
| Distinct failure classes | 236 |
| Distinct problem codes | 2546 |
| Distinct cause codes | 0 |
| Distinct remedy codes | 0 |

<!-- /generated -->

### Column population audit

<!-- generated:failure-audit -->

| Column | Populated rows | Empty rows | Status |
| --- | --- | --- | --- |
| `FAILURE CLASS ID` | 2549 | 0 | Complete |
| `DESCRIPTION` | 2549 | 0 | Complete |
| `PROBLEM CODE` | 2549 | 0 | Complete |
| `PC - DESCRIPTION` | 2549 | 0 | Complete |
| `CAUSE CODE` | 0 | 2549 | **Entirely empty** |
| `CC - DESCRIPTION` | 0 | 2549 | **Entirely empty** |
| `REMEDY CODE` | 0 | 2549 | **Entirely empty** |
| `RC - DESCRIPTION` | 0 | 2549 | **Entirely empty** |

<!-- /generated -->

### A structural observation for DAB

The library holds **2,546 distinct problem codes across 236 failure classes** — very close to one unique
problem per row. Problem codes are therefore almost never reused between classes.

This matters before anyone starts authoring causes and remedies. A well-formed library reuses a modest set of
problems within each class, so that a class of perhaps 10–15 problems needs only 30–50 cause/remedy pairs.
At the current 1:1 ratio, completing the framework would mean authoring cause and remedy sets for 2,546
individual problems — which is not achievable and would produce a list too long for a technician to pick from
on site.

**Recommendation: rationalise the problem list before populating Cause and Remedy.** Consolidating to a
target of 10–15 reusable problems per class reduces the authoring task by roughly two orders of magnitude and
produces a library that is usable in the field. This is the single most valuable action arising from this
document.

---

## 5.4 Proposed code conventions

> Proposed structure, for SEDER to confirm.

| Element | Format | Example |
|---|---|---|
| Failure class | Existing class identifier | `HVAC-SPLIT` |
| Problem code | `P-` + short mnemonic | `P-NOCOOL` |
| Cause code | `C-` + short mnemonic | `C-REFLEAK` |
| Remedy code | `R-` + short mnemonic | `R-REPAIR-CHARGE` |

Rules:

1. Codes are uppercase, no spaces, hyphen-separated.
2. A problem code is unique **within its failure class**, not globally — this is what allows reuse.
3. Every code carries a description written for a technician on site, not for an engineer at a desk.
4. Cause and Remedy are valid **only against a specific problem**. The system already enforces this by
   offering cause options only where the library defines them for the chosen problem.

---

## 5.5 Worked examples

> Illustrative content, prepared to show the intended shape. These are **not** SEDER-approved codes and must
> be reviewed by the maintenance team before entering the library.

### Class: split air-conditioning unit

| Problem | Cause | Remedy |
|---|---|---|
| `P-NOCOOL` — Unit runs but does not cool | `C-REFLEAK` — Refrigerant leak | `R-REPAIR-CHARGE` — Repair leak and recharge |
| | `C-COMPFAIL` — Compressor failure | `R-REPLACE-COMP` — Replace compressor |
| | `C-COILDIRT` — Condenser coil fouled | `R-CLEAN-COIL` — Clean condenser coil |
| `P-NOSTART` — Unit does not start | `C-NOPOWER` — Supply fault or tripped breaker | `R-RESTORE-PWR` — Restore supply, reset protection |
| | `C-CTRLFAIL` — Control board failure | `R-REPLACE-PCB` — Replace control board |
| `P-NOISE` — Abnormal noise or vibration | `C-FANBRG` — Fan bearing worn | `R-REPLACE-FAN` — Replace fan assembly |
| | `C-MOUNTLOOSE` — Mountings loose | `R-SECURE-MOUNT` — Re-secure and align mountings |
| `P-WATERLEAK` — Water leaking from indoor unit | `C-DRAINBLOCK` — Condensate drain blocked | `R-CLEAR-DRAIN` — Clear and flush drain |

### Class: lighting

| Problem | Cause | Remedy |
|---|---|---|
| `P-NOLIGHT` — Fitting does not illuminate | `C-LAMPFAIL` — Lamp or LED module failed | `R-REPLACE-LAMP` — Replace lamp / module |
| | `C-DRIVERFAIL` — Driver or ballast failed | `R-REPLACE-DRIVER` — Replace driver |
| | `C-NOPOWER` — Circuit fault | `R-RESTORE-PWR` — Trace and restore circuit |
| `P-FLICKER` — Fitting flickers | `C-LOOSECONN` — Loose connection | `R-REMAKE-CONN` — Remake connection |
| | `C-DRIVERFAIL` — Driver failing | `R-REPLACE-DRIVER` — Replace driver |

Note how `C-NOPOWER` and `R-RESTORE-PWR` recur across classes. That reuse is the point — it is what keeps the
library small enough to maintain and large enough to be meaningful.

---

## 5.6 What is required to complete this deliverable

| # | Action | Owner |
|---|---|---|
| 1 | Rationalise the 2,546 problem codes to a reusable set per class (5.3) | SEDER maintenance engineering |
| 2 | Confirm the code conventions in 5.4 | SEDER / DAB |
| 3 | Author Cause codes against each retained problem | SEDER maintenance engineering |
| 4 | Author Remedy codes against each cause | SEDER maintenance engineering |
| 5 | Load the completed library into the failure code file | ICT |
| 6 | Confirm CM work orders now require Cause and Remedy at completion | ICT — no code change expected |

Step 6 requires no development. The gating logic is already in place and becomes active on its own as soon as
the library offers cause and remedy options for a problem.

---

## 5.7 Reference — failure classes in the current library

All classes held today, with the number of distinct problem codes in each. Cause and Remedy columns are shown
to make the gap explicit.

<!-- generated:failure-classes -->

| Failure class | Description | Problem codes | Cause codes | Remedy codes |
| --- | --- | --- | --- | --- |
| 3-1-1-01 | IRRIGATION OTHERS - اخري أعمال الري | 62 | 0 | 0 |
| 4-3-3-05 | BOILER OTHERS - اخري الغلايات | 57 | 0 | 0 |
| 4-1-1-01 | AIR HANDLING UNIT OTHERS - اخري وحدة مناولة الهواء | 52 | 0 | 0 |
| 4-3-3-06 | REFRIGERATION OTHERS - اخري التبريد | 43 | 0 | 0 |
| 4-1-1-03 | FAN COIL UNIT OTHERS - اخري وحدة الملف و المروحة | 42 | 0 | 0 |
| 4-3-3-09 | WASHING MACHINE -اخرى غسالة | 41 | 0 | 0 |
| 5-4-1-01 | LIFTS OTHERS - اخري المصاعد | 40 | 0 | 0 |
| 4-2-2-04 | WATER SOFTENER OTHERS - اخري جهاز ازاله عسورة المياه | 36 | 0 | 0 |
| 6-4-1-10 | Computer Network Others -اخري جهاز كمبيوتر | 36 | 0 | 0 |
| 4-1-1-19 | Split unit (SSU) Others -اخري وحدة مكيف اسبليت | 34 | 0 | 0 |
| 4-3-3-03 | GAS SYSTEM  AIR COMPRESSOR OTHERS - اخري انظمة الغازات  وحدة ضغط الهواء | 34 | 0 | 0 |
| 3-1-1-05 | PEST CONTROL OTHERS - اخري مكافحة الآفات | 33 | 0 | 0 |
| 4-1-1-11 | COMPUTER ROOM AIR HANDLER OTHERS - اخري معالج هواء غرفة الكمبيوتر | 32 | 0 | 0 |
| 6-2-1-17 | DDC/DGP OTHERS - اخري لوحة تحكم نظام التحكم بالمباني | 31 | 0 | 0 |
| 6-4-1-01 | AUDIO SYSTEM OTHERS - اخرى نظام الصوت | 31 | 0 | 0 |
| 6-4-1-06 | T.V Distribution System Others -اخري نظام توزيع التقزيون | 30 | 0 | 0 |
| 4-3-3-01 | GAS SYSTEM  LIQUEFIED PETROLEUM GAS SYSTEM OTHERS - اخري انظمة الغازات  نظام الغاز المسال | 28 | 0 | 0 |
| 6-1-1-01 | Telephone Set Others - أعمال جهاز الهاتف أخرى | 27 | 0 | 0 |
| 4-1-1-17 | RTU - Roof Top Unit others - اخرى تكييف مركزي | 26 | 0 | 0 |
| 4-3-3-07 | hot plate Others -اخري سخان سطحي | 26 | 0 | 0 |
| 4-1-1-02 | FAN OTHERS - اخري المروحة | 25 | 0 | 0 |
| 4-2-3-15 | SUBMERSIBLE PUMP OTHERS - اخري المضخات الغاطسة | 24 | 0 | 0 |
| 4-2-6-05 | FIRE ALARM SYSTEM  FM200 SUPPRESSION SYSTEM OTHERS - اخري نظام  إنذار الحريق  نظام اطفاء FM200 | 24 | 0 | 0 |
| 5-4-1-03 | ESCALATORS OTHERS - اخري السلالم | 24 | 0 | 0 |
| 5-4-1-11 | Auto Walk OTHERS - اخري الممشي الكهربائي | 24 | 0 | 0 |
| 3-1-1-06 | LANDSCAPING OTHERS - أعمال زراعة أحري | 23 | 0 | 0 |
| 4-1-1-09 | ECOLOGY UNIT OTHERS - اخري وحدات المعالجة البيئية | 23 | 0 | 0 |
| 4-1-1-21 | COLD ROOOM (CDR)-غرفه التبريدأخرى | 23 | 0 | 0 |
| 4-2-2-01 | PUMP OTHERS - اخري المضخات | 23 | 0 | 0 |
| 4-2-4-05 | BLOWER OTHERS - اخري المروحة | 23 | 0 | 0 |
| 4-2-5-18 | PUMP OTHERS - اخري المضخات | 23 | 0 | 0 |
| 4-1-1-08 | ROOM AIR CONDITIONING OTHERS - اخري تكييف الغرف | 22 | 0 | 0 |
| 4-1-1-18 | WWU Others -اخرى وحدة مكيف شباك | 21 | 0 | 0 |
| 4-2-3-02 | RAIN WATER, SANITARY DRAINAGE AND VENT SYSTEMS OTHERS - اخري أنظمة صرف الامطار والمجاري و تهويتها | 21 | 0 | 0 |
| 4-2-1-01 | PLUMBING, PIPING NETWORK OTHERS - اخري السباكة، أعمال المواسير | 20 | 0 | 0 |
| 4-2-1-09 | HOT WATER STORAGE TANK OTHERS - اخري خزان المياه الساخنة | 20 | 0 | 0 |
| 6-2-1-04 | FIRE SYSTEM OTHERS - اخرى نظام النار | 20 | 0 | 0 |
| 6-2-1-20 | SENSORS OTHERS - اخري الحساسات | 20 | 0 | 0 |
| 4-1-1-14 | CHILLED WATER OTHERS - اخري مياة التبريد | 19 | 0 | 0 |
| 4-1-1-16 | CENTRIFUGAL WATER CHILLERS OTHERS - اخري مسقعات الماء | 19 | 0 | 0 |
| 4-2-1-06 | PLUMBING FIXTURES  SINKS &  BASINS OTHERS - اخري أدوات الصحية  المغاسل | 19 | 0 | 0 |
| 4-2-1-08 | PLUMBING FIXTURES  WATER CLOSET (WC) OTHERS - اخري أدوات الصحية  مقعد الحمام | 19 | 0 | 0 |
| 4-2-1-16 | HOT WATER OTHERS - اخري مياة التدفئة | 19 | 0 | 0 |
| 4-3-1-06 | ELECTRICAL DOORS  GATES OTHERS - اخري الابواب الكهربائية | 19 | 0 | 0 |
| 4-3-3-11 | EXHAUST FAN HOOD Others - اخرى غطاء مروحة العادم | 19 | 0 | 0 |
| 4-1-1-05 | DUCTWORK, INSULATION AND ACCESSORIES OTHERS - اخري ممرات الهواء و عزلها و ملحقاتها | 18 | 0 | 0 |
| 6-2-1-14 | Security Systems Problems Others - مشاكل أنظمة الأمن اخرى | 18 | 0 | 0 |
| 6-3-1-03 | FIRE ALARM SYSTEM  FIRE ALARM  ISSUES OTHERS - اخري نظام  إنذار الحريق   إنذار الحريق | 18 | 0 | 0 |
| 1-1-1-07 | FLOOR OTHERS - اخري أعمال الأرضيات | 17 | 0 | 0 |
| 6-2-1-15 | Building Management System(BMS) Problems Others- مشاكل نظام إدارة المباني اخرى  (BMS) | 17 | 0 | 0 |
| 6-4-1-05 | Call Servant bell Others -اخرى جرس أستدعاء الخادم | 17 | 0 | 0 |
| 1-1-1-19 | STORM WATER NETWORK OTHERS - اخري شبكة مياه الأمطار | 16 | 0 | 0 |
| 4-2-1-10 | ELECTRICAL WATER HEATER OTHERS - اخري سخانات المياه الكهربائية | 16 | 0 | 0 |
| 4-3-3-02 | GAS SYSTEM  VACUUM UNITS OTHERS - اخري انظمة الغازات  وحدة شفط الهواء | 16 | 0 | 0 |
| 4-3-3-12 | Hot and Cold Water Dispenser Others - اخرى موزع المياه الساخنة والباردة | 16 | 0 | 0 |
| 4-3-3-19 | DRINKING FOUNTAIN OTHERS-اخرى نافورة مياه الشرب | 16 | 0 | 0 |
| 6-1-1-02 | Telephone Network Others - أعمال شبكات الهاتف أخرى | 16 | 0 | 0 |
| 1-1-1-08 | DOORS OTHERS - اخري أعمال الابواب | 15 | 0 | 0 |
| 4-2-6-01 | FIRE FIGHTING  FOAM FIRE FIGHTING EXTINGUISHING SYSTEM OTHERS - اخري إطفاء الحريق  نظام اطفاء الحريق بالرغوة | 15 | 0 | 0 |
| 4-3-3-15 | MICROWAVE OVEN OTHERS - اخرى فرن المايكرويف | 15 | 0 | 0 |
| 4-3-3-16 | PORTABLE ICE MAKER OTHERS-اخرى ماكينة صنع الثلج المحمولة | 15 | 0 | 0 |
| 6-4-1-12 | Office Equipments Problems Others - مشاكل المعدات المكتبية اخرى | 15 | 0 | 0 |
| 4-1-1-04 | HVAC & PROCESS PIPING AND ACCESSORIES OTHERS - اخري ملحقات التكييف والأنابيب | 14 | 0 | 0 |
| 4-3-1-07 | ELECTRICAL DOORS  SLIDING DOOR OTHERS - اخري الابواب الكهربائية   الباب الجرار | 14 | 0 | 0 |
| 4-3-3-08 | Dryer -اخرى مجفف | 14 | 0 | 0 |
| 4-2-6-02 | FIRE FIGHTING  PORTABLE AND AUTOMATIC FIRE EXTINGUISHERS OTHERS - اخري إطفاء الحريق  طفايات الحريق | 13 | 0 | 0 |
| 4-2-6-11 | FIRE FIGHTING PLUMBING  WATER FIRE FIGHTING PIPE OTHERS - اخري إطفاء الحريق للسباكة  مواسير اطفاء الحريق المائي | 13 | 0 | 0 |
| 5-1-1-05 | ELECTRICAL FAULT OTHERS - اخري مشكلة كهربائية | 13 | 0 | 0 |
| 1-1-1-09 | CEILINGS OTHERS - اخري أعمال الأسقف | 12 | 0 | 0 |
| 1-1-1-11 | ROADS PAVEMENT OTHERS - اخري أعمال الطرقات | 12 | 0 | 0 |
| 2-1-1-11 | Extra Manpower - اخرى عمالة اضافية | 12 | 0 | 0 |
| 4-1-1-07 | VAV & TERMINAL BOXES OTHERS - اخري صناديق تحكم الهواء الطرفية | 12 | 0 | 0 |
| 4-1-1-10 | ODORS UNIT OTHERS - اخري وحدة معالجة الروائح | 12 | 0 | 0 |
| 4-1-1-20 | DESERT COOLER (DSR) OTHERS- برودة الصحراء أخرى | 12 | 0 | 0 |
| 4-2-1-17 | DOMESTIC HOT WATER OTHERS - اخري مياة الاستخدام المنزلي الساخنة | 12 | 0 | 0 |
| 4-3-1-10 | BARRIER OTHERS - اخري البوابة | 12 | 0 | 0 |
| 5-1-1-06 | WATER COOLING SYSTEM OTHERS - اخري نظام تبريد المياه | 12 | 0 | 0 |
| 5-1-1-11 | Fuel Problem Other - مشكلة الوقود آخرى | 12 | 0 | 0 |
| 5-3-1-09 | MDB OTHERS - اخري لوحة التوزيع الرئيسية | 12 | 0 | 0 |
| 5-3-1-12 | PANEL BOARD OTHERS - اخري لوحة التوزيع | 12 | 0 | 0 |
| 6-1-1-07 | Exchange - PABX - Others -  أعمال السنترال أخرى | 12 | 0 | 0 |
| 4-3-1-08 | SHUTTER DOOR OTHERS - اخري باب المصراع | 11 | 0 | 0 |
| 5-2-1-26 | UPS OTHERS - اخري مزود الطاقة ألإحتياطي | 11 | 0 | 0 |
| 5-3-1-10 | MCC / MCP OTHERS - اخري لوحة المحرك المركزية/لوحة التحكم بالمحرك | 11 | 0 | 0 |
| 6-2-1-02 | ACCESS CONTROL OTHERS - اخرى صلاحية التحكم- صلاحية الدخول | 11 | 0 | 0 |
| 6-2-1-21 | VAV OTHERS - اخري صندوق التحكم في الهواء | 11 | 0 | 0 |
| 6-2-1-27 | SCADA  MV SCADA PLANT OTHERS - اخري نظام مراقبة وتحكم  محطة نظام و مراقبة الجهد المتوسط | 11 | 0 | 0 |
| 6-4-1-11 | Call Servant bell Others -اخرى جرس أستدعاء الخادم | 11 | 0 | 0 |
| 3-1-1-04 | IN-DOOR PLANTOTHERS - اخري نباتات الظل الداخلية | 10 | 0 | 0 |
| 4-2-6-13 | FIRE FIGHTING PLUMBING  FIRE HOSE REEL OTHERS - اخري إطفاء الحريق للسباكة  خزانة خرطوم الحريق | 10 | 0 | 0 |
| 5-1-1-02 | NO STARTING OTHERS - اخري لا يبدء شغل | 10 | 0 | 0 |
| 5-3-1-07 | LIGHTS  ECB OTHERS - اخري الانارة  نظام بطاريات الطوارئ المركزي | 10 | 0 | 0 |
| 5-3-1-16 | FINAL BRANCHES  SOCKET OUTLET OTHERS - اخري التوصيلات النهائية  مقابس الكهرباء | 10 | 0 | 0 |
| 6-2-1-18 | DAMPER ACTUATORS OTHERS - اخري المحركات | 10 | 0 | 0 |
| 6-4-1-16 | Public Address System(AUD) Problems Others -  مشاكل نظام العناوين العامة أخري (AUD) | 10 | 0 | 0 |
| 1-1-1-02 | PAINTING OTHERS - اخري أعمال الدهان | 9 | 0 | 0 |
| 1-1-1-06 | WALL OTHERS - اخري أعمال الجدران | 9 | 0 | 0 |
| 1-1-1-17 | FABRICATION OTHERS - اخري أعمال التوليف | 9 | 0 | 0 |
| 2-1-1-12 | GENERAL CLEANING  -اخرى نظافة عامة | 9 | 0 | 0 |
| 4-2-1-04 | PLUMBING FIXTURES  BIDET OTHERS - اخري أدوات الصحية  الشطافة | 9 | 0 | 0 |
| 4-2-2-09 | TANK OTHERS - اخري الخزان | 9 | 0 | 0 |
| 4-3-3-13 | COFFEE MACHINE (AUTOMATIC) OTHERS -اخرى ماكينة القهوة (الأوتوماتيكية) | 9 | 0 | 0 |
| 4-3-3-14 | INSECT KILLER (UV LIGHTS) OTHERS-اخرى قاتل الحشرات (الأشعة فوق البنفسجية) | 9 | 0 | 0 |
| 5-3-1-08 | GROUNDING/LIGHTENING SYSTEM OTHERS - اخري نظام التأريض/الحماية من الصواعق | 9 | 0 | 0 |
| 6-2-1-03 | SURVEILLANCE SYSTEM Others - اخرى نظام المراقبة | 9 | 0 | 0 |
| 6-2-1-19 | CONTROL VALVES OTHERS - اخري محبس التحكم | 9 | 0 | 0 |
| 6-4-1-07 | Fax Machine Others -اخري جهاز فاكس | 9 | 0 | 0 |
| 6-4-1-09 | Photocopier Others -اخري آلة تصوير | 9 | 0 | 0 |
| 6-4-1-13 | T.V Distribution System Others -اخري نظام توزيع التقزيون | 9 | 0 | 0 |
| 1-1-1-04 | CARPENTER OTHERS - اخري أعمال الخشب | 8 | 0 | 0 |
| 1-1-1-05 | WINDOWS OTHERS - اخري النوافذ | 8 | 0 | 0 |
| 1-1-1-16 | WATER PROOFING OTHERS - اخري أعمال العزل المائي | 8 | 0 | 0 |
| 4-2-1-03 | PLUMBING FIXTURES  BATHTUB OTHERS - اخري أدوات الصحية  حوض الاستحمام | 8 | 0 | 0 |
| 4-2-1-07 | PLUMBING FIXTURES  URINAL OTHERS - اخري أدوات الصحية  المبولة | 8 | 0 | 0 |
| 4-2-2-07 | FUEL STORAGE TANKS OTHERS - اخري خزان تخزين الوقود | 8 | 0 | 0 |
| 5-2-1-02 | PACKAGE SUBSTATION  LV COMPARTMENT PROBLEM OTHERS - اخري محطة فرعية خارجية  عطل في حجيرة الجهد المنخفض | 8 | 0 | 0 |
| 5-3-1-11 | DP (DISTRIBUTION PANEL) OTHERS - اخري لوحة التوزيع الفرعية | 8 | 0 | 0 |
| 5-3-1-13 | FEEDER PILLAR OTHERS - اخري الموزع الكهربائي | 8 | 0 | 0 |
| 6-1-1-08 | Operator Console Others - أعمال جهاز المأمور أخرى | 8 | 0 | 0 |
| 2-1-1-14 | Furniture -اخرى الاثاث | 7 | 0 | 0 |
| 4-1-1-06 | AIR OUTLETS OTHERS - اخري مخارج الهواء | 7 | 0 | 0 |
| 4-2-1-05 | PLUMBING FIXTURES  SHOWER OTHERS - اخري أدوات الصحية  الدوشات | 7 | 0 | 0 |
| 4-2-2-06 | WATER FILTER OTHERS - اخري فلتر الماء | 7 | 0 | 0 |
| 4-2-2-08 | INTERCEPTOR OTHERS - اخري المصيدة | 7 | 0 | 0 |
| 4-3-3-10 | PRESS MACHINE -اخرى آلة الضغط | 7 | 0 | 0 |
| 4-3-3-18 | SANDWICH MAKER OTHERS - اخرى صانع الشطائر | 7 | 0 | 0 |
| 5-1-1-12 | Lubrication system others - نظام التشحيم آخرى | 7 | 0 | 0 |
| 5-3-1-06 | LIGHTS  EIB SYSTEM OTHERS - اخري الانارة  نظام التحكم بالإنارة | 7 | 0 | 0 |
| 5-3-1-15 | FINAL BRANCHES OTHERS - اخري التوصيلات النهائية | 7 | 0 | 0 |
| 6-1-1-04 | Lead Acid Battery Others - أعمال بطاريات آسيدي أخرى | 7 | 0 | 0 |
| 6-1-1-09 | Peripheral Others -  أعمال الفرعيات أخرى | 7 | 0 | 0 |
| 1-1-1-01 | SIGNAGE OTHERS - اخري لافتات الأسماء والأرقام | 6 | 0 | 0 |
| 1-1-1-12 | FURNITURE OTHERS - اخري الأثاث | 6 | 0 | 0 |
| 4-2-2-03 | EXPANSION TANK OTHERS - اخري خزان التمدد | 6 | 0 | 0 |
| 4-2-2-13 | PNEUMATIC OTHERS - اخري  الناقل | 6 | 0 | 0 |
| 4-2-3-10 | SEWAGE NETWORK OTHERS - اخري شبكة مياه الصرف الصحي | 6 | 0 | 0 |
| 4-2-4-14 | BLOWER related to H.V.A.C. OTHERS - اخري المروحة تبع مكيفات | 6 | 0 | 0 |
| 4-3-1-05 | ELECTRICAL DOORS  SHUTTER DOOR OTHERS - اخري الابواب الكهربائية | 6 | 0 | 0 |
| 4-3-3-17 | FRUIT BLENDER OTHERS-اخرى خلاط الفاكهة | 6 | 0 | 0 |
| 5-2-1-03 | PACKAGE SUBSTATION  TRANSFORMER OTHERS - اخري محطة فرعية خارجية  المحول | 6 | 0 | 0 |
| 5-2-1-29 | ELECTRICAL NETWORK OTHERS - اخري الشبكات الكهربائية | 6 | 0 | 0 |
| 5-3-1-03 | LIGHTS  FIXTURE OTHERS - اخري الانارة  وحدة الانارة | 6 | 0 | 0 |
| 5-3-1-22 | ATS OTHERS - اخري مفتاح تحويل المصدر الآلي | 6 | 0 | 0 |
| 6-2-1-22 | AIR VALVES OTHERS - اخري محابس الهواء | 6 | 0 | 0 |
| 6-3-1-04 | FIRE ALARM SYSTEM  VESDA & LHD OTHERS - اخري نظام  إنذار الحريق  نظام مبكر و حساس بانذار الحريق و نظام انذالر حريق حراري | 6 | 0 | 0 |
| 6-4-1-08 | Shredder Machine Others -اخرى  الفرامة | 6 | 0 | 0 |
| 1-1-1-20 | CARPET OTHERS - اخري الموكيت | 5 | 0 | 0 |
| 2-1-1-01 | CARPET OTHERS - اخري الموكيت | 5 | 0 | 0 |
| 2-1-1-05 | ROOF TOP OTHERS - اخري الأسطح | 5 | 0 | 0 |
| 2-1-1-08 | PARKING AREAS OTHERS - اخري مواقف الأنتظار | 5 | 0 | 0 |
| 2-1-1-09 | ACCESSORIES OTHERS - اخري الااكسسورات | 5 | 0 | 0 |
| 4-1-1-12 | RADIATOR OTHERS - اخري المشعات الحرارية | 5 | 0 | 0 |
| 4-1-1-13 | PLATE TO PLATE HEAT EXCHANGER OTHERS - اخري المبادلات الحرارية | 5 | 0 | 0 |
| 4-2-1-11 | FOUNTAINS OTHERS - اخري  النوافير | 5 | 0 | 0 |
| 4-2-2-02 | AIR SEPARATOR OTHERS - اخري فاصل الهواء | 5 | 0 | 0 |
| 4-2-6-12 | FIRE FIGHTING PLUMBING  FIRE SPRINKLERS OTHERS - اخري إطفاء الحريق للسباكة  رشاشات الحريق | 5 | 0 | 0 |
| 5-1-1-07 | PRE-HEATING FAULTOTHERS - اخرى مشكلة قبل التسخين | 5 | 0 | 0 |
| 5-2-1-01 | PACKAGE SUBSTATION  MV COMPARTMENT PROBLEM OTHERS - اخري محطة فرعية خارجية  عطل في حجيرة الجهد المتوسط | 5 | 0 | 0 |
| 5-2-1-28 | POWER FACTOR CORRECTOR OTHERS - اخري عامل القدرة الكهربائية | 5 | 0 | 0 |
| 5-3-1-04 | LIGHTS  EXIT SIGN OTHERS - اخري الانارة  وحدة انارة المخارج | 5 | 0 | 0 |
| 6-1-1-03 | Sealed Battery Others - أعمال البطاريات المغلقة أخرى | 5 | 0 | 0 |
| 6-1-1-05 | Battery Charger Others - أعمال شاحن البطاريات أخرى | 5 | 0 | 0 |
| 6-1-1-06 | UPS - أعمال امداد طاقة غير متقطعة أخرى | 5 | 0 | 0 |
| 6-2-1-24 | WATER LEAK DETECTION OTHERS - اخري نظام كشف تسرب المياه | 5 | 0 | 0 |
| 6-2-1-25 | GAS LEAK DETECTION OTHERS - اخري نظام كشف تسرب الغاز | 5 | 0 | 0 |
| 1-1-1-03 | MASON OTHERS - اخري أعمال تلبيس حجر | 4 | 0 | 0 |
| 2-1-1-03 | GLASS & FACADES OTHERS - اخري الزجاج والواجهات | 4 | 0 | 0 |
| 2-1-1-04 | ROADS & SIDE WALKS OTHERS - اخري الطرق والممرات الجانبية | 4 | 0 | 0 |
| 5-2-1-27 | UPS  BATTERIES OTHERS - اخري مزود الطاقة ألإحتياطي  البطاريات | 4 | 0 | 0 |
| 5-3-1-02 | LIGHTS  LAMP OTHERS - اخري الانارة  المصابيح (اللمبات) | 4 | 0 | 0 |
| 5-3-1-14 | MOTOR STARTER OTHERS - اخري بادئ الحركة للمحرك | 4 | 0 | 0 |
| 6-2-1-23 | METERS OTHERS - اخري العدادات | 4 | 0 | 0 |
| 6-2-1-26 | SCADA OTHERS - اخري نظام مراقبة وتحكم و اكتساب المعلومات عن بعد (سكادا) | 4 | 0 | 0 |
| 1-1-1-10 | GUTTERS OTHERS - اخري أعمال المزاريب | 3 | 0 | 0 |
| 2-1-1-02 | Wall OTHERS - اخري الحوائط | 3 | 0 | 0 |
| 2-1-1-06 | MARBLE OTHERS - اخري الرخام | 3 | 0 | 0 |
| 2-1-1-07 | ESCALATORS & ELEVATORS OTHERS - اخري السلالم والمصاعد | 3 | 0 | 0 |
| 2-1-1-13 | Deep Cleaning -اخري نظافة عميقة | 3 | 0 | 0 |
| 3-1-1-07 | AIR HANDLING UNIT OTHERS - اخري وحدة مناولة الهواء | 3 | 0 | 0 |
| 4-2-2-15 | Water Meter Others  -اخرى  عداد مياه | 3 | 0 | 0 |
| 4-2-2-16 | valves Others  - صمامات اخرى | 3 | 0 | 0 |
| 5-2-1-04 | PACKAGE SUBSTATION OTHERS - اخري محطة فرعية خارجية | 3 | 0 | 0 |
| 5-2-1-05 | PACKAGE SUBSTATION OTHERS - اخري محطة فرعية خارجية | 3 | 0 | 0 |
| 5-2-1-31 | GOLF CAR OTHERS - اخرى سيارة الجولف | 3 | 0 | 0 |
| 5-3-1-01 | LIGHTS OTHERS - اخري الانارة | 3 | 0 | 0 |
| 5-3-1-05 | LIGHTS  SWITCH OTHERS - اخري الانارة  مفتاح | 3 | 0 | 0 |
| 5-4-1-02 | LIFTS  LAMP OTHERS - اخري المصاعد  مصباح | 3 | 0 | 0 |
| 1-1-1-13 | TABLES OTHERS - اخري الطاولات | 2 | 0 | 0 |
| 1-1-1-15 | STRUCTURE  OTHERS - اخرياعمال البناء | 2 | 0 | 0 |
| 2-1-1-10 | MAIN KITCHEN OTHERS - اخري المطبخ الرئيسي | 2 | 0 | 0 |
| 3-1-1-02 | NURSERY OTHERS - اخري المشتل | 2 | 0 | 0 |
| 3-1-1-03 | CUT FLOWER OTHERS - اخري الأزهار والورود | 2 | 0 | 0 |
| 5-1-1-03 | OVER SPEED OTHERS - اخري يجتاز السرعة القياسية | 2 | 0 | 0 |
| 5-2-1-30 | Battery Charger Problem - اخرى شاحن البطارية متضرر | 2 | 0 | 0 |
| 5-3-1-19 | SCORE BOARD OTHERS - اخري جهاز عرض النتيجة الرياضي | 2 | 0 | 0 |
| 6-3-1-06 | NO SMOKING AREA Others - اخرى ممنوع التدخين | 2 | 0 | 0 |
| 6-3-1-07 | Emergency Exit Sign Board Others -  اخرى لوحات مخارج الطوارىء | 2 | 0 | 0 |
| 6-3-1-08 | Hot Work Others - اخرى العمل الساخن | 2 | 0 | 0 |
| 1-1-1-14 | BOARDS OTHERS - اخري الالواح | 1 | 0 | 0 |
| 1-1-1-18 | CIVIL WORKS OTHERS - اخري الأعمال المدنية | 1 | 0 | 0 |
| 4-1-1-15 | HVAC OTHERS - اخرى تكييف وتبريد | 1 | 0 | 0 |
| 4-2-2-12 | RO WATER TREATMENT  OTHERS - اخري تحلية مياه الشرب | 1 | 0 | 0 |
| 4-2-2-14 | HYDRAULIC AND UTILITY OTHERS - اخري الهيدروليكية والمرافق | 1 | 0 | 0 |
| 4-3-1-04 | Electrical Curtain OTHERS - اخري الستائر الكهربائية | 1 | 0 | 0 |
| 4-3-1-09 | SHUTTER DOOR CONTROL SYSTEM OTHERS - اخري جهاز التحكم بالبوابة | 1 | 0 | 0 |
| 4-3-3-04 | GAS SYSTEM OTHERS - اخري انظمة الغازات | 1 | 0 | 0 |
| 5-1-1-01 | OIL TEMP FAULT OTHERS - اخري مشكلة عداد الزيت | 1 | 0 | 0 |
| 5-1-1-04 | EXCITATION CUT FAULT OTHERS - اخري توقف اثناء التشغيل | 1 | 0 | 0 |
| 5-1-1-08 | CABLE FAULT OTHERS - اخري عطل في الكيبل | 1 | 0 | 0 |
| 5-1-1-09 | CABLE TERMINATION OTHERS - اخري توصيلات الكيبل | 1 | 0 | 0 |
| 5-1-1-10 | DAMAGED OTHERS - اخري متضرر | 1 | 0 | 0 |
| 5-2-1-06 | POWER FAILURE OTHERS - اخري انقطاع التيار | 1 | 0 | 0 |
| 5-2-1-07 | SWITCHGEAR  \  RMU PROBLEM OTHERS - اخري لوحةتحكم الفصل والوصل / وحدة الربط الرئيسية | 1 | 0 | 0 |
| 5-2-1-08 | CABLE TERMINATION OTHERS - اخري توصيل نهايات الكيبل الكهربائي | 1 | 0 | 0 |
| 5-2-1-09 | PROTECTION RELAY FAULT OTHERS - اخري عطل مُرَحّل الحماية | 1 | 0 | 0 |
| 5-2-1-10 | SF6 PROBLEM OTHERS - اخري عطل SF6 | 1 | 0 | 0 |
| 5-2-1-11 | EARTH FAULT OTHERS - اخري عطل أرضي | 1 | 0 | 0 |
| 5-2-1-12 | TRIP FAULT OTHERS - اخري عطل فصل الكهرباء المفاجىء | 1 | 0 | 0 |
| 5-2-1-13 | DC RECTIFIER ALARM OTHERS - اخري انذار مُصَحِّح التيار المباشر (المستمر) | 1 | 0 | 0 |
| 5-2-1-14 | DISTRIBUTOR OTHERS - اخري لوحة التوزيع الرئيسية (الموزع) | 1 | 0 | 0 |
| 5-2-1-15 | TRIP OTHERS - اخري فصل الكهرباء المفاجىء | 1 | 0 | 0 |
| 5-2-1-16 | EARTH FAULT OTHERS - اخري عطل أرضي | 1 | 0 | 0 |
| 5-2-1-17 | BUS TIE PROBLEM OTHERS - اخري عطل قضيب التوصيل | 1 | 0 | 0 |
| 5-2-1-18 | FAULTY ALARM OTHERS - اخري اندار وجود عطل | 1 | 0 | 0 |
| 5-2-1-19 | MCC STARTER PANEL PROBLEM OTHERS - اخري عطل لوحة بادئ حركة المحرك (الماتور) | 1 | 0 | 0 |
| 5-2-1-20 | VSD PROBLEM OTHERS - اخري عطل بادئ حركة | 1 | 0 | 0 |
| 5-2-1-21 | GROUNDING DEFECTS OTHERS - اخري اعطال التاريض | 1 | 0 | 0 |
| 5-2-1-22 | POWER METER OTHERS - اخري عداد القدرة | 1 | 0 | 0 |
| 5-2-1-23 | CIRCUIT BREAKER OTHERS - اخري قاطع كهربائي | 1 | 0 | 0 |
| 5-2-1-24 | SWITCH OTHERS - اخري مفتاح | 1 | 0 | 0 |
| 5-2-1-25 | MV TERMINATION PROBLEM OTHERS - اخري اعطال توصيلات الجهد المتوسط | 1 | 0 | 0 |
| 5-3-1-17 | INTERCOM PROBLEM OTHERS - اخري مشكلة الانتركم | 1 | 0 | 0 |
| 5-3-1-18 | GARBAGE CHUTE CONTROLLER OTHERS - اخري جهاز التخلص من النفايات | 1 | 0 | 0 |
| 5-3-1-20 | SWIMMING POOL ELECTRICAL SYSTEM OTHERS - اخري نظام حوض السباحة الكهربائي | 1 | 0 | 0 |
| 5-3-1-21 | RIGGING SYSTEM PROBLEM OTHERS - اخري نظام المسرح | 1 | 0 | 0 |
| 5-3-1-23 | MOTOR OTHERS - اخري المحرك | 1 | 0 | 0 |

<!-- /generated -->

---

*Generated tables in this document come from `docs/generate.mjs`. Regenerate with `node docs/generate.mjs`.
Sections 5.4 and 5.5 are hand-written proposals and are not generated from system data.*

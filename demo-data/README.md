# TRACE Demo Data — Prakasam District, Andhra Pradesh
# Case: Organised Robbery Gang — January 2024

We generate data in two formats to accommodate your needs during presentation and system testing:
1. **Operator Format (Prakasam_District_Operator_...csv)**: Represents the raw, standard DoT/TRAI layout police receive directly from telecom carriers. Includes realistic operators, circle, cell-ID/LAC details. Use these to display or print as mock authentic files.
2. **Compatible Format (COMPATIBLE_Prakasam_District_...csv)**: Fully compatible with the TRACE system's direct upload parser. Use these to import data into the app!

## Suspect Profiles & Files
- **Suspect A: Ravi Kumar Reddy** (Primary Suspect, Ongole)
  - `Prakasam_District_Operator_CDR_SuspectA_Ravi_Kumar_9441234567.csv`
  - `COMPATIBLE_Prakasam_District_CDR_SuspectA_Ravi_Kumar_9441234567.csv`
  - `Prakasam_District_Operator_IPDR_SuspectA_Ravi_Kumar_9441234567.csv`
  - `COMPATIBLE_Prakasam_District_IPDR_SuspectA_Ravi_Kumar_9441234567.csv`

- **Suspect B: Suresh Babu Naidu** (Co-Accused / Distributor, Chirala)
  - `Prakasam_District_Operator_CDR_SuspectB_Suresh_Babu_9963456789.csv`
  - `COMPATIBLE_Prakasam_District_CDR_SuspectB_Suresh_Babu_9963456789.csv`
  - `Prakasam_District_Operator_IPDR_SuspectB_Suresh_Babu_9963456789.csv`
  - `COMPATIBLE_Prakasam_District_IPDR_SuspectB_Suresh_Babu_9963456789.csv`

- **Suspect C: Ramaiah Yadav** (Facilitator, Kandukur)
  - `Prakasam_District_Operator_CDR_SuspectC_Ramaiah_Yadav_9849000312.csv`
  - `COMPATIBLE_Prakasam_District_CDR_SuspectC_Ramaiah_Yadav_9849000312.csv`

## Columns Reference (Standard vs Compatible)
- **Operator CDR Columns**: Sl_No, A_Party_MSISDN, B_Party_MSISDN, Date, Time, Duration_Sec, Call_Type, IMEI, IMSI, Cell_ID, LAC, Tower_Name, Tower_Latitude, Tower_Longitude, Telecom_Circle, Operator, Roaming_Flag, Remarks
- **Compatible CDR Columns**: msisdn_a, msisdn_b, imei, tower_id, tower_lat, tower_lon, call_type, duration_sec, timestamp
- **Operator IPDR Columns**: Sl_No, MSISDN, IMSI, Allocated_IP, Start_Date, Start_Time, End_Date, End_Time, Duration_Sec, Upload_KB, Download_KB, Dest_IP, Dest_Port, Protocol, App_Label, Cell_ID, Tower_Latitude, Tower_Longitude, Telecom_Circle, Operator
- **Compatible IPDR Columns**: msisdn, dest_ip, dest_port, data_volume_kb, timestamp

## Story Timeline (Prakasam District Robbery Case)
1. **Ravi Kumar Reddy** operates out of **Ongole Central**.
2. **Jan 3: IMEI Swap** — Ravi swaps his phone at 18:13 hrs (old IMEI `356812094523001` -> new IMEI `490123456789012`).
3. **Jan 4: Coordination Burst** — Primary suspect conducts 32 panic calls in one day coordinating with Suresh Babu and handler.
4. **Jan 5: Silence** — Suspects go dark/silent.
5. **Jan 6: Crime Area Movement** — Ravi coordinates from **Markapur** (near the scene of interest).
6. **Jan 7: Co-location Event** — Ravi Kumar Reddy and Suresh Babu Naidu are detected active on the same **Chirala Town** tower between 14:55 and 15:30.
7. **Common Contact** — Both suspects call the same unidentified handler number `+91-9912000111`.

## Uploading to TRACE
1. Create a Case (e.g. "Prakasam Robbery Gang").
2. Click **Upload Records** for Suspect A: Use `COMPATIBLE_Prakasam_District_CDR_SuspectA_Ravi_Kumar_9441234567.csv` and `COMPATIBLE_Prakasam_District_IPDR_SuspectA_Ravi_Kumar_9441234567.csv`. Set name: **Ravi Kumar Reddy**.
3. Upload Suspect B: Use `COMPATIBLE_Prakasam_District_CDR_SuspectB_Suresh_Babu_9963456789.csv` and `COMPATIBLE_Prakasam_District_IPDR_SuspectB_Suresh_Babu_9963456789.csv`. Set name: **Suresh Babu Naidu**.
4. Upload Suspect C: Use `COMPATIBLE_Prakasam_District_CDR_SuspectC_Ramaiah_Yadav_9849000312.csv`. Set name: **Ramaiah Yadav**.
5. Trigger **Analyze** in the Case details. TRACE will automatically flag the IMEI Swapping, Co-Locations at Chirala, Common Handler Contact, and Anomaly scores!

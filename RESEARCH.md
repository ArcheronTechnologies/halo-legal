# Halo Pulse — Annotated Bibliography

The primary sources behind [`PLAN.md`](PLAN.md), [`ARCHITECTURE.md`](ARCHITECTURE.md), and
[`VALIDATION.md`](VALIDATION.md), grouped by theme. Each entry states the specific claim it supports
in this plan, not a general summary of the source. Compiled from three parallel research passes
(physiological signal pipeline; ML/datasets/validation/ethics; implementation ecosystem).

---

## A. rPPG algorithms

- **Wang et al., "Algorithmic Principles of Remote-PPG"** — [researchgate](https://www.researchgate.net/publication/308022525_Algorithmic_Principles_of_Remote-PPG) — defines **POS**, the plan's default rPPG combiner.
- **pavisj/rppg-pos** — [github](https://github.com/pavisj/rppg-pos) — reference POS implementation used to cross-check the clean-room TypeScript port.
- **Álvarez-Casado et al., "Face2PPG"** — [arXiv:2202.04101](https://arxiv.org/abs/2202.04101) — introduces **OMIT** and its specific robustness to video compression, the basis for adding OMIT alongside POS.
- **Pilz et al., "Local Group Invariance," CVPRW 2018** — [PDF](https://openaccess.thecvf.com/content_cvpr_2018_workshops/papers/w27/Pilz_Local_Group_Invariance_CVPR_2018_paper.pdf) — defines **LGI**, used for high-motion windows.
- **de Haan & Jeanne, CHROM (2013)** — foundational chrominance-based method, the plan's fallback/comparison combiner (see review below for synthesis).
- **"Review on remote heart rate measurement," Springer 2023** — [link](https://link.springer.com/article/10.1007/s11042-023-16794-9) — comparative synthesis showing model-based methods (CHROM/PBV/POS) beat non-model-based (GREEN/PCA/ICA) under motion; basis for ranking classical methods.
- **Contrast-Phys / Contrast-Phys+** — [arXiv:2208.04378](https://arxiv.org/pdf/2208.04378) — unsupervised deep rPPG (no ground-truth labels needed), the DL candidate favored for its lighter data/licensing burden.
- **rPPG-Toolbox, NeurIPS 2023** — [github](https://github.com/ubicomplab/rPPG-Toolbox) / [PDF](https://ubicomplab.cs.washington.edu/pdfs/rppg-toolbox.pdf) — standardized benchmark implementing all classical methods plus DeepPhys/PhysNet/TS-CAN/EfficientPhys/PhysFormer; **RAIL-licensed**, used only as the harness's reference oracle, never shipped (see §F and ADR-0005).
- **pyVHR** — [github](https://github.com/phuselab/pyVHR) — 9-method comparison pipeline + dataset loaders; **GPL-3.0**, harness-only.
- **iphys-toolbox** — [github](https://github.com/danmcduff/iphys-toolbox) — compact MATLAB reference implementations of GREEN/ICA/CHROM/POS used as a readable porting source.

## B. rPPG preprocessing, timestamps, and signal quality

- **"rPPG in the wild — online webcams"** — [PMC11362249](https://pmc.ncbi.nlm.nih.gov/articles/PMC11362249/) — naturalistic webcam study; source for the Lomb–Scargle alternative to interpolation and for realistic accuracy numbers (§D).
- **"Real-time webcam HR/HRV with clean ground truth"** — [arXiv:2012.15846](https://arxiv.org/abs/2012.15846) — supports the ≥30 fps requirement for reliable HRV extraction.
- **Tarvainen et al., smoothness-priors detrending** — [researchgate](https://www.researchgate.net/publication/11307496_An_advanced_detrending_method_with_application_to_HRV_analysis) — the detrending method specified in the pipeline (§`ARCHITECTURE.md` §4.1).
- **Elgendi, "Optimal Signal Quality Index for PPG"** — [PMC5597264](https://pmc.ncbi.nlm.nih.gov/articles/PMC5597264/) — basis for using **skewness** as a primary SQI component.
- **"Optimal SQI for remote PPG," npj Biosensing 2024** — [nature.com](https://www.nature.com/articles/s44328-024-00002-1) — rPPG-specific SQI validation.

## C. HRV physiology and its measurement limits

- **"HRV as a stress measure," systematic review** — [PMC9974008](https://pmc.ncbi.nlm.nih.gov/articles/PMC9974008/) — source for the "11 of 17 studies" finding and the moderate-but-real strength-of-evidence framing in `VALIDATION.md` §1.
- **"LF/HF ratio ambiguity," Frontiers in Physiology 2017** — [link](https://www.frontiersin.org/articles/10.3389/fphys.2017.00360/full) — the physiological case against treating LF/HF as a clean sympathovagal-balance index; direct basis for de-emphasizing LF/HF.
- **Ultra-short HRV validity** — [PLOS ONE](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0138921) — supports RMSSD's validity from short (~10–30 s) windows.
- **Critical review of ultra-short HRV norms** — [PMC7710683](https://pmc.ncbi.nlm.nih.gov/articles/PMC7710683/) — caveats on short-window HRV norms, informs the "trend not absolute value" framing.
- **"Naturalistic webcam rPPG HRV study"** — [PMC13106271](https://pmc.ncbi.nlm.nih.gov/articles/PMC13106271/) — source of the concrete RMSSD/SDNN error numbers (~11 ms) in `VALIDATION.md` §2.2.
- **"Robust HRV from facial video," MDPI Bioengineering** — [PMC10376629](https://pmc.ncbi.nlm.nih.gov/articles/PMC10376629/) — corroborates webcam HRV error magnitude.
- **HRV test–retest reliability** — [PMC10691965](https://pmc.ncbi.nlm.nih.gov/articles/PMC10691965/) — basis for the ICC test–retest metric in the validation study.
- **"HRV & acute stress," Frontiers in Neuroscience** — [link](https://www.frontiersin.org/journals/neuroscience/articles/10.3389/fnins.2020.00645/full) — direction-of-effect reference (HR↑, RMSSD↓, LF/HF↑) used and then qualified in `PLAN.md` §2.1.

## D. rPPG accuracy benchmarks

- **Wearable HR validation methodology** — [JMIR Formative Research](https://formative.jmir.org/2025/1/e70835/PDF) — source for the "MAPE < 10% / ±5 bpm" accuracy convention used in `VALIDATION.md` §6.1.
- **Bland–Altman for device agreement** — [PMC5796427](https://pmc.ncbi.nlm.nih.gov/articles/PMC5796427/) — methodological basis for using Bland–Altman throughout the validation plan.
- **"rPPG datasets overview & difficulty," incl. MMPD** — [arXiv:2404.06483](https://arxiv.org/pdf/2404.06483) — source of the MMPD dataset description and cross-condition difficulty grading used in `VALIDATION.md` §4.1.

## E. Skin-tone bias in rPPG (the fairness gate)

- **Nowara et al., "Meta-Analysis of the Impact of Skin Tone and Gender," CVPRW 2020** — [PDF](https://openaccess.thecvf.com/content_CVPRW_2020/papers/w19/Nowara_A_Meta-Analysis_of_the_Impact_of_Skin_Tone_and_Gender_CVPRW_2020_paper.pdf) — source of the ~4→13+ bpm MAE degradation figures light→dark skin, for both classical and DL methods.
- **"Demographic bias in rPPG datasets," npj Digital Medicine 2025** — [nature.com](https://www.nature.com/articles/s41746-025-01973-9) — documents dataset-level under-representation of darker skin tones, motivating deliberate diverse sampling in the validation study.
- **"Diverse R-PPG"** — [arXiv:2010.12769](https://arxiv.org/pdf/2010.12769) — further quantification of skin-tone-related error.
- **PhysFlow, skin-tone transfer augmentation** — [arXiv:2407.21519](https://arxiv.org/html/2407.21519v1) — a candidate mitigation technique (skin-tone-aware normalization/augmentation) noted as secondary to the hard release gate.
- **Monk Skin Tone scale in dermatology** — [JAAD](https://www.jaad.org/article/S0190-9622(25)02226-1/fulltext) — basis for choosing the Monk over the Fitzpatrick scale.
- **"Monk vs. Fitzpatrick"** — [metropolitanskinclinic.com](https://metropolitanskinclinic.com/blog/monk-skin-tone-scale-vs-fitzpatrick-skin-tone-scale-what-you-need-to-know/) — practical comparison supporting the same choice.
- **Validity of subjective skin-tone scales** — [PMC12494915](https://pmc.ncbi.nlm.nih.gov/articles/PMC12494915/) — source of the inter-annotator-agreement caveat attached to Monk-scale labeling in `VALIDATION.md` §6.4.

## F. rPPG/HRV reusable libraries and licensing

- **rPPG-Toolbox**, **pyVHR** — see §A; RAIL and GPL-3.0 respectively, harness-only (see [ADR-0005](docs/adr/0005-local-only-and-clean-licensing.md)).
- **NeuroKit2** — [github](https://github.com/neuropsychology/NeuroKit) / [PyPI](https://pypi.org/project/neurokit2/) — MIT-licensed HRV computation, the harness's primary HRV oracle.
- **HeartPy** — [github](https://github.com/paulvangentcom/heartrate_analysis_python) — MIT-licensed, noise-robust peak detection; used as a cross-check on inter-beat-interval extraction.
- **heartbeat-js** — [github](https://github.com/prouast/heartbeat-js) — the one browser rPPG demo found; **GPL-3.0**, reference-only, not depended on.
- **"rPPG in the wild," Behavior Research Methods 2024** — [Springer](https://link.springer.com/article/10.3758/s13428-024-02398-0) — background on webcam-rPPG feasibility from the same author as the heartbeat-js demo.

---

## G. Facial behavioural markers of stress

- **BIOPAC Action Unit reference** — [biopac.com](https://www.biopac.com/facial-action-units/) — AU definitions (AU4 brow-lowerer, AU7 lid-tightener, etc.) used throughout `PLAN.md` §2.2.
- **FACS cheat sheet** — [melindaozel.com](https://melindaozel.com/facs-cheat-sheet/) — quick-reference AU combinations, including the AU4+5+7+23 "anger" combination cited as a confound example.
- **Giannakakis et al., "Stress and anxiety detection using facial cues from videos"** — [ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S1746809416300805) — the most-cited webcam facial-stress study (eye/mouth/head-motion features, up to 91.68% AdaBoost accuracy); source of the caveat that such numbers are small-N/within-session and shouldn't be read as production accuracy.
- **Giannakakis et al., "Automatic stress detection evaluating models of facial AUs"** — [PDF](https://users.ics.forth.gr/~troussos/Giannakakis+_AutomaticStressDetectionEvaluatingModelsOfFfacialAUs_FaGeW20.pdf) — AU-model detail behind the same line of work.
- **"Explainable AU-based stress recognition," 2024** — [ACM](https://dl.acm.org/doi/10.1016/j.cmpb.2024.108507) — explainable-ML ranking of stress-relevant AUs.
- **"Blendshape features meet action units," 2026** — [ScienceDirect](https://www.sciencedirect.com/science/article/pii/S2451958826001995) — expert-validated (10 clinical psychologists, 88% unanimous / 98% majority-supported) mapping from MediaPipe's 52 blendshapes to FACS AUs; the direct justification for `ARCHITECTURE.md` §3.2's blendshape→AU table.
- **MediaPipe Face Landmarker solution page** — [developers.google.com](https://developers.google.com/mediapipe/solutions/vision/face_landmarker) — blendshape output reference.

## H. Blink rate and pupil signals

- **"Rapid serial blinks"** — [PLOS ONE](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0225897) — blink suppression during focused cognitive events (e.g., surgeons mid-operation).
- **"Effect of cognitive load on blinking"** — [Plymouth PDF](https://pearl.plymouth.ac.uk/cgi/viewcontent.cgi?article=1311&context=tpss) — corroborates blink suppression under load.
- **"Eye-blink rate variability and cognition"** — [PMC5742176](https://pmc.ncbi.nlm.nih.gov/articles/PMC5742176/) — blink-rate *increase* post-task and with anxiety — together with the two sources above, the direct basis for treating blink rate as **bidirectional** and scoring it as deviation-from-baseline rather than a fixed direction (`PLAN.md` §2.2).
- **"Blinking duration variability"** — [ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S1746809421004808) — blink-duration variability as an emotional-state discriminator, supporting blink-rate variability as a feature.
- **"Spontaneous blink rate/amplitude as anxiety markers"** — [PLOS ONE](https://journals.plos.org/plosone/article?10.1371%2Fjournal.pone.0338262) — further blink/anxiety linkage.
- **PupilSense / EyeDentify** — [arXiv:2407.11204](https://arxiv.org/html/2407.11204) — recent webcam pupil-diameter extraction work; its low accuracy/condition-dependence is the basis for **excluding pupil size from v1**.
- **"Pupillometry for remote stress sensing"** — [ACM](https://dl.acm.org/doi/fullHtml/10.1145/3529190.3534729) — pupil dilation under stress (~30–33% under hard tasks) as a genuine but hard-to-capture signal.
- **"Task-evoked pupillary response"** — [Stanford PDF](http://graphics.stanford.edu/~klingner/publications/MeasuringPupillaryResponse.pdf) — foundational pupillometry-under-load reference.

## I. The facial-expression / emotion-inference controversy

- **Barrett et al., "Emotional Expressions Reconsidered," 2019** — [PMC6640856](https://pmc.ncbi.nlm.nih.gov/articles/PMC6640856/) / [SAGE](https://journals.sagepub.com/doi/10.1177/1529100619832930) — the foundational critique: facial configurations are only ~15–25% reliable for a given emotion and fail specificity/generalizability/validity criteria. This is the direct basis for never surfacing emotion labels and using descriptive, not inferential, language throughout the product (`PLAN.md` §2.3, §7).
- **MIT Technology Review, "AI emotion recognition... regulation, ethics"** — [link](https://www.technologyreview.com/2020/02/14/844765/ai-emotion-recognition-affective-computing-hirevue-regulation-ethics/) — the HireVue case study (facial-expression analysis removed from its hiring product after an EPIC/FTC complaint) used as a cautionary precedent.
- **"Tech companies claim AI can recognise emotions, but the science doesn't stack up"** — [The Conversation](https://theconversation.com/tech-companies-claim-ai-can-recognise-human-emotions-but-the-science-doesnt-stack-up-243591) — corroborating critique of commercial emotion-AI claims.

## J. Machine learning approach

- **Global stress detection with Random Forest** — [PMC10255919](https://pmc.ncbi.nlm.nih.gov/articles/PMC10255919/) — representative classical-ML accuracy (~84%) used to calibrate realistic expectations.
- **WESAD machine-learning benchmark** — [medRxiv](https://www.medrxiv.org/content/10.1101/2024.04.27.24305829v1.full.pdf) — source of the ~86.5% RF number and the general RF/XGBoost-dominates-the-credible-literature observation.
- **"Cross-dataset HRV stress generalizability"** — [PMC9960690](https://pmc.ncbi.nlm.nih.gov/articles/PMC9960690/) — quantifies the cross-dataset F1 drop (0.71→0.57 for logistic regression); the central evidence for requiring cross-dataset/LOSO evaluation rather than trusting within-dataset splits.
- **Hybrid transfer learning for cross-subject emotion recognition** — [Frontiers](https://www.frontiersin.org/journals/human-neuroscience/articles/10.3389/fnhum.2023.1280241/full) — illustrates how large the naive cross-subject gap is (56.7%→76.3% with transfer learning), supporting "personalize before you deepen."
- **Hybrid deep stress models (CNN-LSTM-Transformer)** — [Springer](https://link.springer.com/article/10.1007/s44163-025-00412-8) — survey of temporal deep architectures considered (and deferred beyond the MVP DL-rPPG layer) for the v2+ scorer.
- **CNN-Transformer-LSTM for HRV-based stress** — [techscience.com](https://www.techscience.com/jai/v6n1/58897) — further temporal-deep-model reference.

## K. Datasets

- **rPPG-Toolbox PDF** — see §A — catalogues UBFC-rPPG, PURE, SCAMPS, MMPD, iBVP, UBFC-Phys, BP4D+ with standardized loaders.
- **UBFC-Phys** — [IEEE DataPort](https://ieee-dataport.org/open-access/ubfc-phys-2) — the primary stress-construct-validity dataset (face video + BVP/EDA + TSST-style protocol + anxiety self-report).
- **StressID** — [project.inria.fr/stressid](https://project.inria.fr/stressid/) — secondary multimodal stress dataset.
- **WESAD** — [UCI](https://archive.ics.uci.edu/ml/datasets/WESAD+(Wearable+Stress+and+Affect+Detection)) — physiology-only (no face) LOSO benchmark.

## L. Stress induction protocols and self-report instruments

- **TSST protocol guide** — [PDF](https://www.psychologie.uni-freiburg.de/abteilungen/psychobio/neuePublikationen/neuroscibiobehavrev-tsstprotocol19.pdf) — canonical TSST procedure.
- **TSST methodology review** — [PMC7739033](https://pmc.ncbi.nlm.nih.gov/articles/PMC7739033/) — effect-size evidence (Cohen's d ≈ 0.93 for cortisol).
- **Remote/online TSST validation** — [Salimetrics](https://salimetrics.com/trier-social-stress-test-validating-remote-tsst-online-protocol/) — supports a remote-compatible variant if ever needed.
- **MIST, original description** — [Semantic Scholar](https://www.semanticscholar.org/paper/The-Montreal-Imaging-Stress-Task:-using-functional-Dedovic-Renwick/f302695ed6699f9f3b96b330660fdb6e4c30b0c3) — the recommended practical desk-based induction protocol.
- **Social-evaluative Stroop** — [ResearchGate](https://www.researchgate.net/publication/365137737_The_Stroop_Competition_A_Social-Evaluative_Stroop_Test_for_Acute_Stress_Induction) — the secondary induction task.
- **MIST/arithmetic and cortisol response** — [academia.edu](https://www.academia.edu/88567776/The_Montreal_Imaging_Stress_Task_using_functional_imaging_to_investigate_the_effects_of_perceiving_and_processing_psychosocial_stress_in_the_human_brain) — basis for the "only serial subtraction/MIST reliably raises cortisol" caveat.
- **PSS-10 psychometrics** — [CMU PDF](https://www.cmu.edu/dietrich/psychology/stress-immunity-disease-lab/scales/pdf/further-psychometric-support.pdf) — establishes PSS-10 as a **monthly trait** measure, the direct basis for correcting its use from acute to longitudinal validation in `VALIDATION.md` §5.2/§5.5.

## M. Regulatory and ethics

- **EU AI Act, Article 5** — [artificialintelligenceact.eu](https://artificialintelligenceact.eu/article/5/) — the prohibited-practices article, including emotion recognition in workplace/education contexts.
- **FPF, "Red lines under the EU AI Act"** — [fpf.org](https://fpf.org/blog/red-lines-under-eu-ai-act-unpacking-the-prohibition-of-emotion-recognition-in-the-workplace-and-education-institutions/) — analysis of the workplace/education emotion-recognition ban's scope.
- **EU Commission guidance summary** — [WSGR](https://www.wsgrdataadvisor.com/2025/02/eu-commission-issues-guidelines-on-prohibited-ai-practices-under-eu-ai-act/) — practical guidance summary.
- **"Emotion data under EU law"** — [arXiv:2309.10776](https://arxiv.org/pdf/2309.10776) — broader legal analysis of emotion-inference data.
- **"Digital emotion detection and privacy"** — [PMC12106471](https://pmc.ncbi.nlm.nih.gov/articles/PMC12106471/) — privacy-framework discussion informing `PLAN.md` §7.
- **ICO biometric-data guidance** — [ico.org.uk](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/biometric-data-guidance-biometric-recognition/how-do-we-process-biometric-data-lawfully/) — basis for the GDPR Art. 9 "biometric vs. health-inference" analysis in `PLAN.md` §7.
- **ACLU-IL, BIPA overview** — [aclu-il.org](https://www.aclu-il.org/campaigns-initiatives/biometric-information-privacy-act-bipa/) — Illinois biometric-statute background.
- **"BIPA identifiers must identify," Morrison Foerster** — [mofo.com](https://www.mofo.com/resources/insights/240503-getting-bipa-right-biometric-identifiers-must-identify) — the ruling basis for why a non-identifying, on-device-only design is lower-risk under BIPA.
- **BIPA electronic-consent update** — [Greenberg Traurig](https://www.gtlaw.com/en/insights/2024/8/bipa-update-illinois-limits-liability-and-clarifies-electronic-consent-for-biometric-data-collection) — recent BIPA amendment context.
- **FDA, "General Wellness: Policy for Low Risk Devices"** — [fda.gov](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/general-wellness-policy-low-risk-devices) — the wellness/medical-device boundary the product stays inside of.
- **2026 FDA guidance summary** — [Troutman](https://www.troutman.com/insights/fdas-2026-guidance-on-fdas-2026-guidance-on-general-wellness-devices-policy-for-low-risk-devices/) — current-year update to the same guidance.

---

## N. Browser capture and rendering

- **MDN, `MediaStreamTrack.applyConstraints()`** — [link](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/applyConstraints) — the API for refining capture constraints live.
- **MDN, Media Capture and Streams constraints** — [link](https://developer.mozilla.org/en-US/docs/Web/API/Media_Capture_and_Streams_API/Constraints) — general constraint-negotiation behavior, including silent cropping/downscaling.
- **addpipe, "getUserMedia video constraints"** — [blog](https://blog.addpipe.com/getusermedia-video-constraints/) — practical documentation of light-dependent frame-rate drops.
- **web.dev, `requestVideoFrameCallback`** — [link](https://web.dev/articles/requestvideoframecallback-rvfc) — the primary source for using rVFC/`mediaTime` as the per-frame timestamp fix.
- **MDN, `requestVideoFrameCallback`** — [link](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback) — API reference and browser support.
- **WHATWG Canvas spec** — [link](https://html.spec.whatwg.org/multipage/canvas.html) — basis for `getImageData()` being a GPU→CPU readback cost.
- **webrtcHacks, "Video frame processing on the web"** — [link](https://webrtchacks.com/video-frame-processing-on-the-web-webassembly-webgpu-webgl-webcodecs-webnn-and-webtransport/) — survey of frame-processing approaches informing the tiny-canvas ROI readback design.
- **"Image processing with WebGL"** — [Medium](https://medium.com/eureka-engineering/image-processing-with-webgl-c2af552e8df0) — basis for the optional WebGL/mipmap-reduction path.
- **nasir6/rPPG** — [github](https://github.com/nasir6/rPPG) — one of the scattered browser rPPG demos surveyed (reference-only).
- **Chrome, "WebCodecs best practices"** — [link](https://developer.chrome.com/docs/web-platform/best-practices/webcodecs) — informs the WebCodecs/`VideoFrame` optimization path noted as future work.
- **MDN, `VideoFrame`** — [link](https://developer.mozilla.org/en-US/docs/Web/API/VideoFrame) — API reference for the same.

## O. MediaPipe Face Landmarker

- **`@mediapipe/tasks-vision` on npm** — [link](https://www.npmjs.com/package/@mediapipe/tasks-vision) — current version/license (0.10.35, Apache-2.0) cited in `ARCHITECTURE.md` §3.
- **Face Landmarker web guide** — [developers.google.com](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js) — API usage reference.
- **Face Landmarker (ai.google.dev)** — [link](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker) — output shape (478 landmarks, 52 blendshapes, transform matrix).
- **Blendshape V2 model card** — [PDF](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20Blendshape%20V2.pdf) — the specific blendshape set used in §G/`ARCHITECTURE.md` §3.2.
- **ARKit blendshape reference** — [arkit-face-blendshapes.com](https://arkit-face-blendshapes.com/) — naming/definition reference for the 52 blendshapes.
- **"Running MediaPipe Tasks Vision in a Web Worker"** — [ankdev.me](https://ankdev.me/blog/how-to-run-mediapipe-task-vision-in-a-web-worker) — basis for the Worker-threading design.
- **478-point landmark map** — [sanderdesnaijer.com](https://www.sanderdesnaijer.com/blog/mediapipe-face-mesh-landmarks) — source for the forehead/cheek ROI landmark indices.
- **Landmark index community Q&A** — [Kaggle](https://www.kaggle.com/questions-and-answers/393052) — corroborating index references, with the caveat that community maps should be visually validated.
- **`@tensorflow-models/face-landmarks-detection`** — [npm](https://www.npmjs.com/package/@tensorflow-models/face-landmarks-detection) — evaluated and rejected as stale (~2 years since last publish).

## P. DSP and on-device ML runtime

- **`fili.js`** — [npm](https://www.npmjs.com/package/fili) / [github](https://github.com/markert/fili.js) — the Butterworth band-pass filter library specified in `ARCHITECTURE.md` §4.2.
- **`fft.js`** — [github](https://github.com/indutny/fft.js/) — the FFT library for the Welch PSD estimate.
- **`webfft`** — [github](https://github.com/IQEngine/WebFFT) — noted alternative auto-selecting the fastest FFT backend.
- **WebGPU browser support** — [web.dev](https://web.dev/blog/webgpu-supported-major-browsers) — confirms WebGPU availability across major browsers by 2026, the basis for making it the primary `onnxruntime-web` backend.
- **ORT Web vs. TF.js performance** — [LogRocket](https://blog.logrocket.com/ai-in-browsers-comparing-tensorflow-onnx-and-webdnn-for-image-classification/) — comparative perf informing the WASM-for-small-models guidance.
- **"ONNX Runtime Web unleashes generative AI... using WebGPU"** — [Microsoft Open Source blog](https://opensource.microsoft.com/blog/2024/02/29/onnx-runtime-web-unleashes-generative-ai-in-the-browser-using-webgpu/) — basis for choosing `onnxruntime-web`/WebGPU as the on-device DL runtime.

## Q. Storage, visualization, and PWA packaging

- **Dexie vs. idb vs. RxDB** — [bswen.com](https://docs.bswen.com/blog/2026-04-07-indexeddb-libraries-dexie-idb-rxdb/) — comparison behind choosing Dexie for the multi-table, migration-heavy schema.
- **Dexie.js** — [dexie.org](https://dexie.org/) — library reference.
- **npm-compare, dexie vs. idb** — [link](https://npm-compare.com/dexie,idb) — supplementary comparison data.
- **MDN, storage quotas and eviction criteria** — [link](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) — basis for the `navigator.storage.persist()` mitigation.
- **WebKit storage policy** — [webkit.org](https://webkit.org/blog/14403/updates-to-storage-policy/) — source of the ~7-day Safari eviction figure.
- **`dexie-encrypted`** — [github](https://github.com/dexie/dexie-encrypted) — the optional at-rest encryption library, and the reason it uses `tweetnacl.js` rather than Web Crypto.
- **uPlot** — [github](https://github.com/leeoniya/uPlot) — the chosen series/trend charting library; performance figures cited in `ARCHITECTURE.md` §7.
- **Casey Primozic, notes on uPlot** — [cprimozic.net](https://cprimozic.net/notes/posts/my-thoughts-on-the-uplot-charting-library/) — independent performance corroboration.
- **cal-heatmap** — [cal-heatmap.com](https://cal-heatmap.com/) — the time-of-day heatmap library.
- **React charting library comparison** — [Medium](https://medium.com/@ponshriharini/comparing-8-popular-react-charting-libraries-performance-features-and-use-cases-cc178d80b3ba) — basis for avoiding Recharts/Chart.js on hot paths.
- **Vite PWA, `generateSW`** — [vite-pwa-org.netlify.app](https://vite-pwa-org.netlify.app/workbox/generate-sw) — precaching configuration reference.
- **Vite PWA, service-worker precache docs** — [link](https://vite-pwa-org.netlify.app/guide/service-worker-precache) — basis for the `globPatterns`/`maximumFileSizeToCacheInBytes` overrides needed for the MediaPipe and ONNX assets.
- **web.dev, COOP/COEP** — [link](https://web.dev/articles/coop-coep) — basis for the "stay single-threaded to avoid cross-origin isolation" design constraint.
- **Tauri vs. Electron trade-offs** — [gethopp.app](https://www.gethopp.app/blog/tauri-vs-electron) — comparison behind the desktop-packaging guidance.
- **Electron vs. Tauri comparison** — [DoltHub](https://www.dolthub.com/blog/2025-11-13-electron-vs-tauri/) — corroborating comparison, including per-OS WebView behavior differences.

## R. Python harness tooling

- **`mediapipe` on PyPI** — [link](https://pypi.org/project/mediapipe/) — current version reference.
- **Python 3.13 incompatibility note** — [YouTrack](https://youtrack.jetbrains.com/articles/SUPPORT-A-2182/Installing-the-MediaPipe-Package-with-Python-3.13-in-PyCharm) — the reason the harness pins Python 3.12.
- **pnpm workspaces** — [pnpm.io](https://pnpm.io/workspaces) — the monorepo package-management approach.
- **pnpm + Vite + Vitest monorepo guide** — [blog.glen-thomas.com](https://blog.glen-thomas.com/software%20engineering/2025/10/02/mastering-pnpm-workspaces-complete-guide-to-monorepo-management.html) — practical setup reference for `ARCHITECTURE.md` §9.

# Scriba - Research Paper Recommendation & Trend Analysis System

Scriba is an offline-first, interactive research paper recommendation and intelligence dashboard built as an academic mini-project. It enables researchers to upload abstracts, extract keywords using a custom RAKE NLP algorithm, obtain recommendations using a hybrid multi-criteria retrieval formula, and visualize the research landscape through K-Means clustering and PCA projections.

---

## 🌟 Key Features

1. **Document Parsing**: Drag and drop PDF or TXT research papers. The system extracts page text dynamically and feeds it into the NLP pipeline offline.
2. **Custom Keyword Extraction**: Uses a custom **RAKE (Rapid Automatic Keyword Extraction)** algorithm written from scratch in Python to map key topics based on word degree-to-frequency ratios.
3. **Hybrid Matching Recommender**: Computes a combined match percentage based on:
   * **Semantic Relevance**: TF-IDF Cosine Similarity.
   * **Impact Factor**: Log-normalized citation counts.
   * **Temporal Relevance**: Exponential time-decay based on publication age.
4. **Interactive 2D Research Landscape**: Clusters the offline dataset using **K-Means Clustering ($K=5$)** and projects the document space to 2D coordinates using **PCA (Principal Component Analysis)** for a visual scatter plot.
5. **Research Trends Velocity**: Dynamic timelines and growth rate indexes tracking topic popularity (2018 - 2026) using Chart.js.
6. **Local Database Expansions**: Add custom papers via the UI to re-index the TF-IDF vocabulary and re-cluster the scatter mapping instantly.

---

## 🛠️ Technology Stack

* **Backend**: Python 3, Flask, pandas, numpy, scikit-learn, pypdf
* **Frontend**: HTML5, CSS3 (Custom Glassmorphism styling variables), JavaScript (ES6+), Chart.js

---

## 🚀 Setup & Execution Instructions

Ensure you have Python 3 installed. Then follow these steps:

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/jdbruh18/-Scriba---Research-Paper-Recommendation-Trend-Analysis-System.git
   cd -Scriba---Research-Paper-Recommendation-Trend-Analysis-System
   ```

2. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Run the Server**:
   ```bash
   python app.py
   ```

4. **Access the Application**:
   Open your browser and navigate to:
   [**http://127.0.0.1:5000/**](http://127.0.0.1:5000/)

---

## 📈 Core Mathematical Modeling

### 1. RAKE Word Scoring
$$\text{Score}(w) = \frac{\text{Degree}(w)}{\text{Frequency}(w)}$$
*Frequency* measures word occurrences, while *Degree* measures word co-occurrences in candidate phrases.

### 2. Hybrid Similarity Scoring
$$\text{MatchScore} = w_{\text{sim}} \cdot \text{CosineSim}(q, d) + w_{\text{cite}} \cdot \frac{\ln(1+C)}{\ln(1+C_{\text{max}})} + w_{\text{time}} \cdot e^{-\lambda \Delta t}$$
* Where:
  * $\text{CosineSim}(q, d) = \frac{\vec{q} \cdot \vec{d}}{\|\vec{q}\| \|\vec{d}\|}$ (using TF-IDF vectors).
  * $C$ is the paper's citation count; $C_{\text{max}}$ is the max citation count in the database.
  * $\Delta t$ is the age of the publication; $\lambda = 0.15$ (exponential decay constant).
  * $w_{\text{sim}}, w_{\text{cite}}, w_{\text{time}}$ are weight coefficients summing to $1.0$ (adjustable via the UI sliders).

### 3. Dimensionality Reduction
$$X_i, Y_i = \text{PCA}(\vec{V}_{\text{tfidf}}, 2)$$
Reduces high-dimensional TF-IDF vectors into 2D coordinates for visual representation.

---

## 📁 Repository Structure
```
├── app.py                  # Flask Application Router & API Controllers
├── requirements.txt        # Backend dependencies
├── data/
│   └── papers.csv          # Offline CSV Database (150 papers)
├── engine/
│   ├── rake.py             # Custom RAKE NLP implementation
│   ├── recommender.py      # Hybrid recommendation scorer
│   └── clustering.py       # K-Means clustering and PCA reducer
├── templates/
│   └── index.html          # Dashboard HTML skeleton
├── static/
│   ├── css/
│   │   └── styles.css      # Custom Glassmorphic Dark-mode stylesheet
│   └── js/
│   │   └── main.js         # Chart.js renderers, sliders sync, and REST API controller
├── project_synopsis.md     # Academic project report and presentation guide
└── how_it_works.md         # Detailed sequence flow diagram and architecture explanation
```

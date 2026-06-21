import pandas as pd
import numpy as np
import os
import re
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

class PaperRecommender:
    def __init__(self, csv_path="d:/siddarth/data/papers.csv"):
        self.csv_path = csv_path
        self.papers_df = None
        self.vectorizer = None
        self.tfidf_matrix = None
        self.current_year = 2026 # Reference year based on system time
        self.load_dataset()

    def load_dataset(self):
        """
        Loads the offline CSV dataset and fits the TF-IDF model.
        """
        if not os.path.exists(self.csv_path):
            raise FileNotFoundError(f"Dataset not found at {self.csv_path}")
        
        self.papers_df = pd.read_csv(self.csv_path)
        # Ensure numerical types are correct
        self.papers_df['citations'] = pd.to_numeric(self.papers_df['citations'], errors='coerce').fillna(0).astype(int)
        self.papers_df['year'] = pd.to_numeric(self.papers_df['year'], errors='coerce').fillna(2020).astype(int)
        self.papers_df['title'] = self.papers_df['title'].fillna("")
        self.papers_df['abstract'] = self.papers_df['abstract'].fillna("")
        self.papers_df['authors'] = self.papers_df['authors'].fillna("Unknown")
        self.papers_df['venue'] = self.papers_df['venue'].fillna("Unknown")
        
        # Combine title and abstract for richer representations (weighting title higher by repeating it)
        combined_text = self.papers_df['title'] + " " + self.papers_df['title'] + " " + self.papers_df['abstract']
        
        self.vectorizer = TfidfVectorizer(stop_words='english', max_features=5000)
        self.tfidf_matrix = self.vectorizer.fit_transform(combined_text)

    def add_paper(self, title, authors, abstract, year, category, venue, citations):
        """
        Appends a new paper to the offline CSV, then re-loads the dataset to update TF-IDF.
        """
        # Read current max ID to increment
        if os.path.exists(self.csv_path):
            df = pd.read_csv(self.csv_path)
            new_id = int(df['id'].max()) + 1 if len(df) > 0 else 1
        else:
            new_id = 1
            
        new_row = {
            "id": new_id,
            "title": title,
            "authors": authors,
            "abstract": abstract,
            "year": int(year),
            "category": category,
            "venue": venue,
            "citations": int(citations)
        }
        
        new_row_df = pd.DataFrame([new_row])
        new_row_df.to_csv(self.csv_path, mode='a', header=not os.path.exists(self.csv_path), index=False)
        
        # Reload vectorizer and matrices
        self.load_dataset()
        return new_row

    def recommend(self, query_abstract, top_n=10, w_sim=0.70, w_cite=0.15, w_time=0.15):
        """
        Computes hybrid recommendation scores by combining:
        1. Cosine similarity of TF-IDF vectors
        2. Log-scaled and normalized citations
        3. Exponential recency decay
        """
        if self.papers_df is None or len(self.papers_df) == 0:
            return []

        # Vectorize query
        query_vector = self.vectorizer.transform([query_abstract])
        
        # 1. Compute Cosine Similarity
        cosine_sims = cosine_similarity(query_vector, self.tfidf_matrix).flatten()
        
        # 2. Compute Citation Score: Log-scaling to compress range
        citations = self.papers_df['citations'].values
        log_citations = np.log1p(citations)
        max_log_cite = np.max(log_citations) if np.max(log_citations) > 0 else 1.0
        min_log_cite = np.min(log_citations)
        # Normalize between 0 and 1
        norm_citations = (log_citations - min_log_cite) / (max_log_cite - min_log_cite + 1e-9)
        
        # 3. Compute Recency Score: Exponential decay e^(-lambda * delta_t)
        years = self.papers_df['year'].values
        delta_years = np.clip(self.current_year - years, 0, None)
        # lambda = 0.15 means ~50% decay in 4.6 years
        recency_scores = np.exp(-0.15 * delta_years)
        
        # Combine into Hybrid Score
        hybrid_scores = (w_sim * cosine_sims) + (w_cite * norm_citations) + (w_time * recency_scores)
        
        # Create results DataFrame
        results = self.papers_df.copy()
        results['similarity'] = cosine_sims
        results['citation_score'] = norm_citations
        results['recency_score'] = recency_scores
        results['hybrid_score'] = hybrid_scores
        
        # Sort by hybrid score descending
        results = results.sort_values(by='hybrid_score', ascending=False)
        
        # Format the output list of dicts
        recommendations = []
        for idx, row in results.head(top_n).iterrows():
            recommendations.append({
                "id": int(row['id']),
                "title": str(row['title']),
                "authors": str(row['authors']),
                "abstract": str(row['abstract']),
                "year": int(row['year']),
                "category": str(row['category']),
                "venue": str(row['venue']),
                "citations": int(row['citations']),
                "similarity_score": float(round(row['similarity'], 4)),
                "citation_score": float(round(row['citation_score'], 4)),
                "recency_score": float(round(row['recency_score'], 4)),
                "hybrid_score": float(round(row['hybrid_score'], 4))
            })
            
        return recommendations

# Self test
if __name__ == "__main__":
    recommender = PaperRecommender("d:/siddarth/data/papers.csv")
    test_abstract = "We investigate deep residual learning models for computer vision and image recognition. We train extremely deep convolutional neural networks."
    recs = recommender.recommend(test_abstract, top_n=3)
    print("Top Recommendations:")
    for r in recs:
        print(f"- {r['title']} (Sim: {r['similarity_score']:.3f}, Hybrid: {r['hybrid_score']:.3f})")

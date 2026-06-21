import pandas as pd
import numpy as np
import os
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA

class ClusteringEngine:
    def __init__(self, csv_path="d:/siddarth/data/papers.csv"):
        self.csv_path = csv_path
        self.n_clusters = 5
        
    def perform_clustering_and_pca(self):
        """
        Runs TF-IDF -> K-Means (K=5) -> PCA (2D)
        Identifies top terms per cluster to dynamically label them.
        """
        if not os.path.exists(self.csv_path):
            return [], {}
            
        df = pd.read_csv(self.csv_path)
        if len(df) == 0:
            return [], {}
            
        # Standardize empty columns
        df['title'] = df['title'].fillna("")
        df['abstract'] = df['abstract'].fillna("")
        df['year'] = pd.to_numeric(df['year'], errors='coerce').fillna(2020).astype(int)
        df['citations'] = pd.to_numeric(df['citations'], errors='coerce').fillna(0).astype(int)
        
        # Combine title and abstract
        combined_text = df['title'] + " " + df['abstract']
        
        # 1. TF-IDF Representation
        vectorizer = TfidfVectorizer(stop_words='english', max_features=1000)
        tfidf_matrix = vectorizer.fit_transform(combined_text)
        
        # 2. K-Means Clustering (K=5)
        # Fix random state for consistency across page loads
        kmeans = KMeans(n_clusters=self.n_clusters, random_state=42, n_init=10)
        cluster_labels = kmeans.fit_predict(tfidf_matrix)
        
        # 3. PCA for 2D Visualization
        pca = PCA(n_components=2, random_state=42)
        coords = pca.fit_transform(tfidf_matrix.toarray())
        
        # 4. Map top keywords to each cluster (using centroid features)
        feature_names = vectorizer.get_feature_names_out()
        centroids = kmeans.cluster_centers_
        cluster_keywords = {}
        
        for i in range(self.n_clusters):
            # Sort centroid weights for cluster i descending
            top_term_indices = centroids[i].argsort()[::-1][:4]
            top_terms = [feature_names[idx] for idx in top_term_indices]
            # Create a label from top terms
            cluster_keywords[i] = " & ".join(top_terms).title()
            
        # Assemble coordinate mapping for frontend D3/Chart.js
        plotted_data = []
        for idx, row in df.iterrows():
            cluster_id = int(cluster_labels[idx])
            plotted_data.append({
                "id": int(row["id"]),
                "title": str(row["title"]),
                "authors": str(row["authors"]),
                "category": str(row["category"]),
                "year": int(row["year"]),
                "citations": int(row["citations"]),
                "x": float(round(coords[idx][0], 4)),
                "y": float(round(coords[idx][1], 4)),
                "cluster_id": cluster_id,
                "cluster_label": cluster_keywords[cluster_id]
            })
            
        return plotted_data, cluster_keywords

if __name__ == "__main__":
    engine = ClusteringEngine("d:/siddarth/data/papers.csv")
    points, labels = engine.perform_clustering_and_pca()
    print("Clusters mapped. Labels generated:")
    for cid, label in labels.items():
        print(f"Cluster {cid}: {label}")
    if points:
        print(f"Sample node: {points[0]['title']} -> X: {points[0]['x']}, Y: {points[0]['y']}, Cluster: {points[0]['cluster_id']}")

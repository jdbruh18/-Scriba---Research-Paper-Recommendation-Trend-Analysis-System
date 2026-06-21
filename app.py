import os
import pandas as pd
from flask import Flask, request, jsonify, render_template, send_from_directory
from pypdf import PdfReader

# Import engine components
from engine.rake import extract_keywords
from engine.recommender import PaperRecommender
from engine.clustering import ClusteringEngine

app = Flask(__name__, static_folder="static", template_folder="templates")

# Initialize recommendation and clustering models
DATA_PATH = "d:/siddarth/data/papers.csv"
recommender = PaperRecommender(DATA_PATH)
clustering_engine = ClusteringEngine(DATA_PATH)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/papers', methods=['GET'])
def get_papers():
    """
    Returns all papers with optional query filters (search term, category, page, limit)
    """
    try:
        search = request.args.get('search', '').lower()
        category = request.args.get('category', '')
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 10))
        
        df = pd.read_csv(DATA_PATH)
        df['citations'] = pd.to_numeric(df['citations'], errors='coerce').fillna(0).astype(int)
        df['year'] = pd.to_numeric(df['year'], errors='coerce').fillna(2020).astype(int)
        df = df.fillna("")
        
        # Apply filters
        if category:
            df = df[df['category'] == category]
            
        if search:
            mask = (
                df['title'].str.lower().str.contains(search) | 
                df['authors'].str.lower().str.contains(search) | 
                df['abstract'].str.lower().str.contains(search) |
                df['venue'].str.lower().str.contains(search)
            )
            df = df[mask]
            
        total_records = len(df)
        
        # Pagination
        start = (page - 1) * limit
        end = start + limit
        paginated_df = df.iloc[start:end]
        
        papers_list = paginated_df.to_dict(orient='records')
        
        return jsonify({
            "status": "success",
            "total": total_records,
            "page": page,
            "limit": limit,
            "papers": papers_list
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/recommend', methods=['POST'])
def get_recommendations():
    """
    Finds similar papers. Supports pasting an abstract or uploading a PDF/TXT file.
    """
    try:
        abstract_text = ""
        
        # Check if file is uploaded
        if 'file' in request.files:
            uploaded_file = request.files['file']
            if uploaded_file.filename != '':
                file_ext = os.path.splitext(uploaded_file.filename)[1].lower()
                if file_ext == '.pdf':
                    # Parse PDF
                    reader = PdfReader(uploaded_file)
                    extracted_text = []
                    for page in reader.pages:
                        text = page.extract_text()
                        if text:
                            extracted_text.append(text)
                    abstract_text = "\n".join(extracted_text)
                elif file_ext == '.txt':
                    # Read TXT
                    abstract_text = uploaded_file.read().decode('utf-8', errors='ignore')
                else:
                    return jsonify({"status": "error", "message": "Unsupported file format. Please upload a PDF or TXT file."}), 400
        else:
            # Check JSON body
            data = request.json or {}
            abstract_text = data.get('abstract', '')

        if not abstract_text or not abstract_text.strip():
            return jsonify({"status": "error", "message": "No abstract content provided."}), 400
            
        # Limit text length to prevent overload
        abstract_text = abstract_text[:10000]
        
        # 1. Extract keywords from the input abstract
        keywords = extract_keywords(abstract_text, top_n=6)
        keyword_list = [kw for kw, score in keywords]
        
        # 2. Get recommendations
        recommendations = recommender.recommend(abstract_text, top_n=10)
        
        return jsonify({
            "status": "success",
            "extracted_text": abstract_text[:1000] + ("..." if len(abstract_text) > 1000 else ""),
            "keywords": keywords,
            "recommendations": recommendations
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/extract-keywords', methods=['POST'])
def do_keyword_extraction():
    try:
        data = request.json or {}
        text = data.get('text', '')
        if not text or not text.strip():
            return jsonify({"status": "error", "message": "No text content provided."}), 400
            
        keywords = extract_keywords(text, top_n=8)
        return jsonify({
            "status": "success",
            "keywords": keywords
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/trends', methods=['GET'])
def get_trends_and_clusters():
    """
    Calculates K-Means clustering, PCA positions, category trends over years, 
    and emerging keyword statistics.
    """
    try:
        # 1. Fetch 2D cluster points and category mappings
        plot_data, cluster_labels = clustering_engine.perform_clustering_and_pca()
        
        # 2. Load dataset for trends
        df = pd.read_csv(DATA_PATH)
        df['year'] = pd.to_numeric(df['year'], errors='coerce').fillna(2020).astype(int)
        df['citations'] = pd.to_numeric(df['citations'], errors='coerce').fillna(0).astype(int)
        
        # 3. Trends Over Time: Year vs Category count
        years = [int(y) for y in sorted(list(df['year'].unique()))]
        categories = sorted(list(df['category'].unique()))
        
        # Initialize counts
        time_series = {cat: [0] * len(years) for cat in categories}
        for idx, row in df.iterrows():
            cat = row['category']
            yr = row['year']
            if cat in time_series and yr in years:
                y_idx = years.index(yr)
                time_series[cat][y_idx] += 1
                
        # 4. Emerging Research Areas (Growth Score)
        # Compare count in recent years (2024-2026) vs preceding (2018-2023)
        recent_mask = df['year'] >= 2024
        old_mask = (df['year'] >= 2018) & (df['year'] < 2024)
        
        recent_counts = df[recent_mask]['category'].value_counts()
        old_counts = df[old_mask]['category'].value_counts()
        
        growth_rates = []
        for cat in categories:
            rec = recent_counts.get(cat, 0)
            old = old_counts.get(cat, 0)
            # Normalize by length of years: 3 years vs 6 years
            rec_avg = rec / 3.0
            old_avg = old / 6.0
            
            # Growth factor (prevent division by zero)
            growth = (rec_avg - old_avg) / (old_avg + 1.0)
            growth_rates.append({
                "category": cat,
                "growth_score": round(growth * 100, 2), # percentage growth index
                "recent_avg": round(rec_avg, 2),
                "historical_avg": round(old_avg, 2)
            })
            
        # Sort by growth rate descending
        growth_rates = sorted(growth_rates, key=lambda x: x['growth_score'], reverse=True)
        
        # 5. Extract top aggregated keywords per category
        category_keywords = {}
        for cat in categories:
            cat_abstracts = " ".join(df[df['category'] == cat]['abstract'].fillna("").astype(str).tolist())
            keywords = extract_keywords(cat_abstracts, top_n=5)
            category_keywords[cat] = [kw for kw, score in keywords]
            
        return jsonify({
            "status": "success",
            "clusters": {
                "nodes": plot_data,
                "labels": {str(k): v for k, v in cluster_labels.items()}
            },
            "timeline": {
                "years": years,
                "series": [{"name": cat, "data": time_series[cat]} for cat in categories]
            },
            "growth": growth_rates,
            "category_keywords": category_keywords
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/add-paper', methods=['POST'])
def add_paper():
    """
    Saves a new research paper and updates indexers.
    """
    try:
        data = request.json or {}
        
        title = data.get('title', '').strip()
        authors = data.get('authors', '').strip()
        abstract = data.get('abstract', '').strip()
        year = data.get('year')
        category = data.get('category', '').strip()
        venue = data.get('venue', '').strip()
        citations = data.get('citations', 0)
        
        if not all([title, authors, abstract, year, category, venue]):
            return jsonify({"status": "error", "message": "Missing required fields."}), 400
            
        # Save and reload recommender TF-IDF model
        new_paper = recommender.add_paper(
            title=title,
            authors=authors,
            abstract=abstract,
            year=year,
            category=category,
            venue=venue,
            citations=citations
        )
        
        # We can also verify that clustering is refreshed dynamically
        return jsonify({
            "status": "success",
            "message": "Paper successfully added to the database and re-indexed.",
            "paper": new_paper
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    # Start flask application
    print("Starting Flask Application on http://127.0.0.1:5000/")
    app.run(host='127.0.0.1', port=5000, debug=True)

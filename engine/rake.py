import re
import math
from collections import defaultdict

# A solid list of English stop-words to remain offline-friendly and self-contained
STOPWORDS = set([
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "arent", "as", "at", 
    "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "cant", "cannot", "could", 
    "couldnt", "did", "didnt", "do", "does", "doesnt", "doing", "dont", "down", "during", "each", "few", "for", 
    "from", "further", "had", "hadnt", "has", "hasnt", "have", "havent", "having", "he", "hed", "hell", "hes", "her", 
    "here", "heres", "hers", "herself", "him", "himself", "his", "how", "hows", "i", "id", "ill", "im", "ive", "if", 
    "in", "into", "is", "isnt", "it", "its", "itself", "lets", "me", "more", "most", "mustnt", "my", "myself", "no", 
    "nor", "not", "of", "off", "on", "once", "only", "or", "other", "ought", "our", "ours", "ourselves", "out", "over", 
    "own", "same", "shant", "she", "shed", "shell", "shes", "should", "shouldnt", "so", "some", "such", "than", "that", 
    "thats", "the", "their", "theirs", "them", "themselves", "then", "there", "theres", "these", "they", "theyd", 
    "theyll", "theyre", "theyve", "this", "those", "through", "to", "too", "under", "until", "up", "very", "was", 
    "wasnt", "we", "wed", "well", "were", "weve", "werent", "what", "whats", "when", "whens", "where", "wheres", 
    "which", "while", "who", "whos", "whom", "why", "whys", "with", "wont", "would", "wouldnt", "you", "youd", 
    "youll", "youre", "youve", "your", "yours", "yourself", "yourselves", "us", "use", "using", "used", "paper",
    "propose", "approach", "method", "results", "analysis", "system", "framework", "performance", "evaluation",
    "experimental", "show", "presents", "presents", "proposed", "new", "simple"
])

def split_sentences(text):
    """
    Splits text into sentences using common punctuation.
    """
    sentence_delimiters = re.compile(r'[.!?,;:\t\-\"\(\)\'\u2019\u2013\n]')
    sentences = sentence_delimiters.split(text)
    return [s.strip().lower() for s in sentences if s.strip()]

def generate_candidate_keywords(sentence_list):
    """
    Generates candidate keyword phrases from a list of sentences by splitting on stop-words.
    """
    candidates = []
    for sentence in sentence_list:
        words = sentence.split()
        phrase = []
        for word in words:
            # Clean word from non-alphanumeric at start/end
            clean_word = re.sub(r'^\W+|\W+$', '', word)
            if clean_word in STOPWORDS or len(clean_word) <= 1:
                if phrase:
                    candidates.append(" ".join(phrase))
                    phrase = []
            else:
                phrase.append(clean_word)
        if phrase:
            candidates.append(" ".join(phrase))
    return [c for c in candidates if c]

def calculate_word_scores(phrase_list):
    """
    Calculates word scores based on frequency and degree.
    score(w) = degree(w) / frequency(w)
    """
    word_frequency = defaultdict(int)
    word_degree = defaultdict(int)
    
    for phrase in phrase_list:
        word_list = phrase.split()
        word_list_length = len(word_list)
        word_degree_val = word_list_length - 1 # word co-occurs with word_list_length - 1 other words
        
        for word in word_list:
            word_frequency[word] += 1
            word_degree[word] += word_degree_val + 1 # degree includes its own occurrence
            
    word_scores = {}
    for word in word_frequency:
        # degree(w) / frequency(w)
        word_scores[word] = word_degree[word] / float(word_frequency[word])
        
    return word_scores

def generate_candidate_keyword_scores(phrase_list, word_scores):
    """
    Sums individual word scores to score candidate phrases.
    """
    candidate_scores = {}
    for phrase in phrase_list:
        word_list = phrase.split()
        candidate_score = 0
        for word in word_list:
            candidate_score += word_scores.get(word, 0)
        candidate_scores[phrase] = candidate_score
    return candidate_scores

def extract_keywords(text, top_n=8):
    """
    Main function to run RAKE and return the top N keywords with scores.
    """
    if not text or not text.strip():
        return []
    
    sentences = split_sentences(text)
    phrases = generate_candidate_keywords(sentences)
    word_scores = calculate_word_scores(phrases)
    phrase_scores = generate_candidate_keyword_scores(phrases, word_scores)
    
    # Sort phrases by score descending
    sorted_phrases = sorted(phrase_scores.items(), key=lambda x: x[1], reverse=True)
    
    # Remove duplicate phrase entries but keep ordering
    seen = set()
    unique_phrases = []
    for phrase, score in sorted_phrases:
        if phrase not in seen:
            seen.add(phrase)
            unique_phrases.append((phrase, round(score, 3)))
            if len(unique_phrases) >= top_n:
                break
                
    return unique_phrases

# Quick self-test if run directly
if __name__ == "__main__":
    test_text = "Deep residual learning for image recognition. We propose a residual learning framework to ease the training of networks that are substantially deeper than those previously used."
    keywords = extract_keywords(test_text)
    print("Extracted Keywords:")
    for kw, score in keywords:
        print(f"- {kw}: {score}")

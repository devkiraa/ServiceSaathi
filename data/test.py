import spacy
import pandas as pd
import random
from spacy.pipeline import EntityRuler
from faker import Faker  # For realistic date generation

fake = Faker()

# Initialize blank spaCy model
nlp = spacy.blank("en")

# Add entity ruler with patterns
ruler = nlp.add_pipe("entity_ruler", config={"overwrite_ents": True})
patterns = [
    {"label": "PERSON", "pattern": [{"LOWER": {"IN": ["john", "mary", "alex", "sara"]}}]},
    {"label": "ORG", "pattern": [{"LOWER": {"IN": ["google", "microsoft", "amazon", "meta"]}}]},
    {"label": "DATE", "pattern": [{"TEXT": {"REGEX": r"\b\d{4}-\d{2}-\d{2}\b"}}]},
    {"label": "GPE", "pattern": [{"LOWER": {"IN": ["london", "tokyo", "paris", "new york"]}}]}
]
ruler.add_patterns(patterns)

def generate_synthetic_data(n_samples):
    """Generate N synthetic samples with entities"""
    people = ["John", "Mary", "Alex", "Sara"]
    orgs = ["Google", "Microsoft", "Amazon", "Meta"]
    locations = ["London", "Tokyo", "Paris", "New York"]
    templates = [
        "{person} works at {org} in {location} since {date}",
        "{person} attended a conference on {date}",
        "The meeting with {person} from {org} is scheduled for {date}",
        "{location} will host the event in {date}",
        "{org} announced new projects starting {date}"
    ]
    
    data = []
    for _ in range(n_samples):
        # Randomize components
        person = random.choice(people)
        org = random.choice(orgs)
        location = random.choice(locations)
        date = fake.date(pattern="%Y-%m-%d")  # Realistic date generation
        
        # Generate text from template
        template = random.choice(templates)
        text = template.format(
            person=person,
            org=org,
            location=location,
            date=date
        )
        
        # Process with spaCy
        doc = nlp(text)
        for ent in doc.ents:
            data.append({
                "text": text,
                "entity_type": ent.label_,
                "entity_value": ent.text
            })
    
    return data

# Generate N=100 samples (change this number as needed)
df = pd.DataFrame(generate_synthetic_data(10000))
df.to_csv("ner_dataset1.csv", index=False)
print(f"Generated {len(df)} entity records")
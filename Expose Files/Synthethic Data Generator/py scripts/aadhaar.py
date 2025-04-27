import csv
import random
from faker import Faker
from datetime import datetime, timedelta

fake = Faker('en_IN')  # Ensures Indian-style names

# Label Map
label_map = {
    6: "AADHAAR_NUMBER",
    11: "ISSUE_DATE",
    0: "NAME",
    3: "DOB",
    29: "SEX",
    1: "ADDRESS",
    41: "OTHERS",
    -100: "IGNORED"
}

def generate_full_name():
    """Generate a random full name with dynamic word count (2-4 words)."""
    num_words = random.randint(2, 4)
    return " ".join([fake.first_name() for _ in range(num_words)]) + " " + fake.last_name()

def generate_aadhaar_entry():
    aadhaar_number = " ".join([str(random.randint(1000, 9999)) for _ in range(3)])
    issue_date = fake.date_between(start_date="-10y", end_date="today").strftime('%d/%m/%Y')
    
    full_name = generate_full_name()  # Ensure dynamic name length
    name_tokens = full_name.split()  # Tokenize Name
    
    dob = fake.date_of_birth(minimum_age=18, maximum_age=60).strftime('%d/%m/%Y')
    sex = random.choice(["Male", "Female"])
    
    address = fake.address().replace("\n", ", ")
    address_tokens = address.split()  # Tokenize Address
    
    # Tokenization & NER tagging
    tokens = []
    ner_tags = []

    def add_field(label, value):
        """Helper function to add field tokens and corresponding NER tags dynamically."""
        value_tokens = value.split()
        tokens.extend(value_tokens)
        ner_tags.extend([label] * len(value_tokens))

    # Static Aadhaar text
    fixed_tokens = [
        "Aadhaar", "no:", "issued:", issue_date, 
        "भारत", "सरकार", "Government", "of", "India", 
        "आधार"
    ]
    fixed_tags = [41] * len(fixed_tokens)

    tokens.extend(fixed_tokens)
    ner_tags.extend(fixed_tags)

    tokens.append("DOB:")
    ner_tags.append(41)
    add_field(3, dob)

    tokens.append("Sex:")
    ner_tags.append(41)
    add_field(29, sex)

    tokens.append("Aadhaar:")
    ner_tags.append(41)
    add_field(6, aadhaar_number)

    fixtok = ["Aadhaar", "is", "proof", "of", "identity,", "not", "of",
        "citizenship", "or", "date", "of", "birth."]
    fixtags = [41] * len(fixtok)

    tokens.extend(fixtok)
    ner_tags.extend(fixtags)

    # Add dynamic fields
    tokens.append("Name:")
    ner_tags.append(41)
    add_field(0, full_name)  # Name tokenized properly

    tokens.append("Address:")
    ner_tags.append(41)
    add_field(1, address)  # Address tokenized properly

    tokens.extend(["Details", "as", "on:"])
    ner_tags.extend([41, 41, 41])
    add_field(11, issue_date)  # Issue Date

    return [tokens, ner_tags, "Aadhaar"]

# CSV File Writing
filename = "synthetic_aadhaar_ner.csv"
header = ["tokens", "ner_tags", "type"]

with open(filename, "w", newline="", encoding="utf-8") as file:
    writer = csv.writer(file)
    writer.writerow(header)
    for _ in range(10000):  # Generate 10,000 entries
        writer.writerow(generate_aadhaar_entry())

print(f"Synthetic NER-tagged Aadhaar data saved to {filename}")

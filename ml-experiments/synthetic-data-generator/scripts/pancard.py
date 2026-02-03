import csv
import random
from faker import Faker
from datetime import datetime

fake = Faker('en_IN')  # Ensures Indian-style names

# Label Map
label_map = {
    0: "NAME",
    1: "PAN_ACC_NO",
    2: "DOB",
    3: "FATHERS_NAME",
    4: "OTHER",
    -100: "IGNORED"
}

def generate_pan_entry():
    pan_number = fake.random_uppercase_letter() + fake.random_uppercase_letter() + \
                 fake.random_uppercase_letter() + fake.random_uppercase_letter() + \
                 fake.random_uppercase_letter() + str(random.randint(1000, 9999)) + \
                 fake.random_uppercase_letter()
    
    full_name = " ".join(fake.words(random.randint(1, 3)))  # Varying number of words in name
    father_name = " ".join(fake.words(random.randint(1, 4)))  # Varying number of words in father's name
    dob = fake.date_of_birth(minimum_age=18, maximum_age=60).strftime('%d/%m/%Y')
    
    # Tokenization & NER tagging
    tokens = []
    ner_tags = []
    
    def add_field(label, value):
        """Helper function to add field tokens and corresponding NER tags dynamically."""
        value_tokens = value.split()
        tokens.extend(value_tokens)
        ner_tags.extend([label] * len(value_tokens))
    
    # Fixed Text
    fixed_tokens = ["Income", "Tax", "Department", "Permanent", "Account", "Number", "Card"]
    fixed_tags = [4] * len(fixed_tokens)  # Mark as "OTHER"
    tokens.extend(fixed_tokens)
    ner_tags.extend(fixed_tags)
    
    add_field(1, pan_number)  # PAN Number
    tokens.append("Name:")
    ner_tags.append(4)
    add_field(0, full_name)  # Name
    
    tokens.append("Father's")
    tokens.append("Name:")
    ner_tags.extend([4, 4])
    add_field(3, father_name)  # Father's Name
    
    tokens.append("Date")
    tokens.append("of")
    tokens.append("Birth:")
    ner_tags.extend([4, 4, 2])
    add_field(2, dob)  # Date of Birth
    
    tokens.extend(["Government", "of", "India"])
    ner_tags.extend([4, 4, 4])  # Mark as "OTHER"
    
    return [tokens, ner_tags]

# CSV File Writing
filename = "synthetic_pan_ner.csv"

header = ["tokens", "ner_tags"]

with open(filename, "w", newline="", encoding="utf-8") as file:
    writer = csv.writer(file)
    writer.writerow(header)
    for _ in range(10000):  # Generates 10,000 entries
        writer.writerow(generate_pan_entry())

print(f"Synthetic NER-tagged PAN card data saved to {filename}")

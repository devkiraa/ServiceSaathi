import csv
import random
from faker import Faker
from datetime import datetime, timedelta

fake = Faker('en_IN')  # Ensures Indian-style names

# Label Map (Similar to Driving License, modified for Voter ID)
label_map = {
    0: "NAME",
    1: "FATHER_NAME",
    2: "GENDER",
    3: "DOB",
    4: "ADDRESS",
    5: "VOTER_ID",
    6: "ISSUE_DATE",
    7: "ELECTORAL_OFFICER",
    -100: "IGNORED"
}

def rand_name_size():
    return random.randint(2, 4)  # Random name length between 2 and 4 words

def generate_full_name():
    num_words = rand_name_size()
    return " ".join([fake.first_name() for _ in range(num_words)]) + " " + fake.last_name()

def generate_voter_id():
    return f"TWH{random.randint(100000000, 999999999)}"

def generate_dob():
    start_date = datetime(1950, 1, 1)
    end_date = datetime(2005, 12, 31)
    dob = start_date + timedelta(days=random.randint(0, (end_date - start_date).days))
    return dob.strftime("%d-%m-%Y")

def generate_issue_date():
    issue_date = datetime.now() - timedelta(days=random.randint(0, 365))
    return issue_date.strftime("%d-%m-%Y")

def generate_address():
    return f"{fake.building_number()}, {fake.street_name()}, {fake.city()}, {fake.state()} - {fake.postcode()}"

def generate_officer_details():
    return f"Electoral Registration Officer, {random.randint(1, 100)} - {fake.city().upper()}"

# Function to generate a synthetic voter ID entry with NER tags
def generate_voter_entry():
    issue_date = generate_issue_date()
    voter_id = generate_voter_id()

    full_name = generate_full_name()  # Dynamic name length
    father_name = generate_full_name()  # Father's name also dynamic

    dob = generate_dob()
    gender = random.choice(["Male", "Female"])
    address = generate_address()
    electoral_officer = generate_officer_details()

    tokens = []
    ner_tags = []

    def add_field(label, value):
        """Helper function to add tokens and NER tags dynamically."""
        value_tokens = value.split()
        tokens.extend(value_tokens)
        ner_tags.extend([label] * len(value_tokens))

    # Prepend fixed header information
    fixed_tokens = ["ELECTION", "COMMISSION", "OF", "INDIA", "Elector's", "Photo", "Identity", "Card"]
    fixed_tags = [-100] * len(fixed_tokens)  # Mark as IGNORED
    
    tokens.extend(fixed_tokens)
    ner_tags.extend(fixed_tags)

    # Voter ID
    tokens.extend(["Voter", "ID:"])
    ner_tags.extend([-100, -100])
    add_field(5, voter_id)  # Voter ID Number

    # Name
    tokens.append("Name:")
    ner_tags.append(-100)
    add_field(0, full_name)  # Name

    # Father's Name
    tokens.append("Father's")
    tokens.append("Name:")
    ner_tags.extend([-100, -100])
    add_field(1, father_name)  # Father's Name

    # Gender
    tokens.append("Gender:")
    ner_tags.append(-100)
    add_field(2, gender)  # Gender

    # Date of Birth
    tokens.extend(["Date", "of", "Birth:"])
    ner_tags.extend([-100, -100, 3])
    add_field(3, dob)  # DOB

    # Address
    tokens.append("Address:")
    ner_tags.append(-100)
    add_field(4, address)  # Address

    # Issue Date
    tokens.extend(["Issue", "Date:"])
    ner_tags.extend([-100, -100])
    add_field(6, issue_date)  # Issue Date

    # Electoral Registration Officer
    tokens.extend(["Electoral", "Registration", "Officer:"])
    ner_tags.extend([-100, -100, -100])
    add_field(7, electoral_officer)  # Electoral Registration Officer

    # Prepend fixed header information
    fixed_tokens_end = ["Before", "every", "Election,", "please", "check", "that", "your", "name", "exists", "in", "the", "current", "electorial", "roll.", "This", "card", "is", "not", "a", "proof", "of", "age", "except", "for", "purpose", "of", "Election.", "1950", "www.ceo.kerala.gov.in"]
    fixed_tags_end = [-100] * len(fixed_tokens_end)  # Mark as IGNORED

    tokens.extend(fixed_tokens_end)
    ner_tags.extend(fixed_tags_end)

    return [tokens, ner_tags]

# CSV File Writing
filename = "synthetic_voter_id_ner.csv"

header = ["tokens", "ner_tags"]

with open(filename, "w", newline="", encoding="utf-8") as file:
    writer = csv.writer(file)
    writer.writerow(header)
    for _ in range(10000):  # Generates 10,000 entries
        writer.writerow(generate_voter_entry())

print(f"Synthetic NER-tagged voter ID data saved to {filename}")

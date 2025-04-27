import csv
import random
from faker import Faker
from datetime import datetime, timedelta

fake = Faker('en_IN')  # Ensures Indian-style names

# Label Map
label_map = {
    0: "CODE",
    1: "NATIONALITY",
    2: "TYPE",
    3: "FILE_NO",
    4: "PASSPORT_NO",
    5: "SURNAME",
    6: "GIVEN NAME",
    7: "DOB",
    8: "SEX",
    9: "PLACE_OF_BIRTH",
    10: "DATE_OF_ISSUE",
    11: "DATE_OF_EXPIRY",
    12: "NAME_OF_FATHER/LEGAL_GAURDIAN",
    13: "NAME_OF_MOTHER",
    14: "NAME_OF_SPOUSE",
    15: "ADDRESS",
    16: "OLD_PASSPORT_NO",
    17: "OLD_PASSPORT_DATE_OF_ISSUE",
    18: "OLD_PASSPORT_PLACE_OF_ISSUE",
    19: "OTHER",
    -100: "IGNORED"
}

def generate_full_name():
    num_words = random.randint(2, 4)  # Dynamic length
    return " ".join([fake.first_name() for _ in range(num_words)]) + " " + fake.last_name()

def generate_passport_entry():
    old_passport_no = f"N{random.randint(1000000, 9999999)}"
    old_passport_issue_date = fake.date_between(start_date="-20y", end_date="-10y").strftime('%d/%m/%Y')
    old_passport_place = fake.city()
    type_value = "P"  # Fixed TYPE value
    file_number = f"FN{random.randint(1000000000, 9999999999)}"  # Random File Number
    passport_no = f"{random.choice(['Y', 'N'])}{random.randint(1000000, 9999999)}"
    nationality = "INDIAN"
    surname = fake.last_name()
    given_name = generate_full_name()
    dob = fake.date_of_birth(minimum_age=18, maximum_age=60).strftime('%d/%m/%Y')
    sex = random.choice(["M", "F"])
    place_of_birth = fake.city()
    date_of_issue = fake.date_between(start_date="-10y", end_date="today").strftime('%d/%m/%Y')
    date_of_expiry = (datetime.strptime(date_of_issue, '%d/%m/%Y') + timedelta(days=10*365)).strftime('%d/%m/%Y')
    father_name = generate_full_name()
    mother_name = generate_full_name()
    spouse_name = generate_full_name()
    address = fake.address().replace("\n", ", ")
    
    tokens = ["Republic", "of", "India"]
    ner_tags = [19, 19, 19]
    
    def add_field(label, field_name, value):
        field_tokens = field_name.split()
        value_tokens = value.split()
        tokens.extend(field_tokens + value_tokens)
        ner_tags.extend([19] * len(field_tokens) + [label] * len(value_tokens))
    
    add_field(0, "Code:", "IN")
    add_field(1, "Nationality:", nationality)
    add_field(2, "Type:", type_value)
    add_field(3, "File Number:", file_number)
    add_field(4, "Passport No:", passport_no)
    add_field(5, "Surname:", surname)
    add_field(6, "Given Name:", given_name)
    add_field(7, "Date of Birth:", dob)
    add_field(8, "Sex:", sex)
    add_field(9, "Place of Birth:", place_of_birth)
    add_field(10, "Date of Issue:", date_of_issue)
    add_field(11, "Date of Expiry:", date_of_expiry)
    add_field(12, "Name of Father/Legal Guardian:", father_name)
    add_field(13, "Name of Mother:", mother_name)
    add_field(14, "Name of Spouse:", spouse_name)
    add_field(15, "Address:", address)
    add_field(16, "Old Passport No:", old_passport_no)
    add_field(17, "Old Passport Date of Issue:", old_passport_issue_date)
    add_field(18, "Old Passport Place of Issue:", old_passport_place)
    
    return [tokens, ner_tags]

# CSV File Writing
filename = "synthetic_passport_ner.csv"
header = ["tokens", "ner_tags"]

with open(filename, "w", newline="", encoding="utf-8") as file:
    writer = csv.writer(file)
    writer.writerow(header)
    for _ in range(10000):
        writer.writerow(generate_passport_entry())

print(f"Synthetic NER-tagged passport data saved to {filename}")

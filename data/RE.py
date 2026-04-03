import pandas as pd
from faker import Faker
import random
from datetime import datetime, timedelta

fake = Faker()
Faker.seed(42)
random.seed(42)

label_map = {
    0: "NAME",
    1: "PERMANENT_ADDRESS",
    2: "PRESENT_ADDRESS",
    3: "DOB",
    4: "GENDER",
    5: "DL_NUMBER",
    6: "ISSUE_DATE",
    7: "VALIDITY_NT",
    8: "VALIDITY_TR",
    9: "COV_CODE",
    10: "LICENSING_AUTHORITY",
    11: "BADGE_NUMBER",
    12: "BADGE_DATE",
    13: "BLOOD_GROUP",
    14: "ORGAN_DONOR",
    15: "GUARDIAN_S_D_W",
    16: "DATE_OF_FIRST_ISSUE",
    17: "EMERGENCY_CONTACT",
    18: "OTHER",
    -100: "IGNORED"
}

def generate_dl_number():
    return f"KL{random.randint(10, 99)} {random.randint(1000000000, 9999999999)}"

def generate_date():
    return fake.date_between(start_date='-20y', end_date='+5y').strftime("%d-%m-%Y")

def generate_sample():
    """Generate a single synthetic sample with random entity types"""
    sample_type = random.choices(
        ['dl', 'blood', 'address', 'emergency', 'name_dob'],
        weights=[0.35, 0.2, 0.2, 0.15, 0.1],
        k=1
    )[0]

    if sample_type == 'dl':
        dl_num = generate_dl_number().split()
        issue_date = generate_date()
        validity_date = generate_date()
        return {
            "tokens": dl_num + ["Issued", "on", issue_date, 
                               "Expires", "on", validity_date],
            "ner_tags": [5, 5, 18, 6, 6, 18, 7, 7]
        }
        
    elif sample_type == 'blood':
        blood_group = random.choice(["A+", "B-", "AB+", "O-"])
        organ_donor = random.choice(["YES", "NO"])
        return {
            "tokens": ["Blood", "Group", blood_group, 
                      "Organ", "Donor", organ_donor],
            "ner_tags": [13, 13, 13, 14, 14, 14]
        }
        
    elif sample_type == 'address':
        perm_address = fake.address().replace('\n', ' ').split()
        pres_address = fake.address().replace('\n', ' ').split()
        return {
            "tokens": ["Permanent", "Address"] + perm_address + 
                     ["Present", "Address"] + pres_address,
            "ner_tags": [1, 1] + [1]*len(perm_address) + 
                      [2, 2] + [2]*len(pres_address)
        }
        
    elif sample_type == 'emergency':
        contact = fake.phone_number()
        return {
            "tokens": ["Emergency", "Contact", contact],
            "ner_tags": [17, 17, 17]
        }
        
    elif sample_type == 'name_dob':
        name = fake.name().split()
        dob = generate_date()
        return {
            "tokens": name + ["DOB", dob],
            "ner_tags": [0, 0, 3, 3]
        }

def create_samples(n_samples):
    """Generate n_samples synthetic samples"""
    samples = []
    for _ in range(n_samples):
        samples.append(generate_sample())
    return samples

# Generate and save data
n = 10000  # Change this value to generate different numbers of samples
df = pd.DataFrame(create_samples(n))
df.to_csv("data.csv", index=False)

print(f"Generated {n} samples with columns: {df.columns.tolist()}")
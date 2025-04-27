import csv
import random
from faker import Faker
from datetime import datetime, timedelta

fake = Faker('en_IN')  # Ensures Indian-style names

# Label Map
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

def rand_name_size():
    return random.randint(2, 4)  # Random length between 2 and 4 words

def generate_full_name():
    num_words = rand_name_size()
    return " ".join([fake.first_name() for _ in range(num_words)]) + " " + fake.last_name()

# Function to generate a synthetic driving license entry with dynamic NER tags
def generate_license_entry():
    issue_date = fake.date_between(start_date="-10y", end_date="today").strftime('%d-%m-%Y')
    issue_date_dt = datetime.strptime(issue_date, '%d-%m-%Y')  # Convert to datetime
    validity_nt = (issue_date_dt + timedelta(days=20 * 365)).strftime('%d-%m-%Y')  # Add 20 years
    validity_tr = validity_nt  # Assuming same validity for TR
    dl_number = f"KL{random.randint(1, 99):02d} {random.randint(2023000000, 2023999999)}"

    full_name = generate_full_name()  # Ensuring dynamic name length
    name_tokens = full_name.split()
    
    dob = fake.date_of_birth(minimum_age=18, maximum_age=60).strftime('%d-%m-%Y')
    blood_group = random.choice(["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"])
    organ_donor = random.choice(["Yes", "No"])

    # Generate parent/spouse name with 2-4 words
    num_guardian_words = random.randint(2, 4)
    parent_spouse_name = " ".join(fake.name().split()[:num_guardian_words])
    guardian_tokens = parent_spouse_name.split()

    address = fake.address().replace("\n", ", ")
    address_tokens = address.split()
    
    # Generate a dynamic number of COV codes (1 to 4)
    cov_code_options = ["HMV", "LMV", "MCWG", "LMV-NT", "MCWOG", "TR"]
    num_cov_codes = random.randint(1, 4)
    cov_codes = random.sample(cov_code_options, num_cov_codes)  # Randomly selecting COV codes

    issued_by = "RTO, " + fake.city()
    badge_number = "NA"  # Default as NA
    badge_date = "NA"  # Default as NA
    date_of_first_issue = issue_date
    emergency_contact = fake.phone_number()

    licensing_authority = f"RTO, {fake.city()}"
    licensing_tokens = licensing_authority.split()

    # Tokenization & NER tagging
    tokens = []
    ner_tags = []

    def add_field(label, value):
        """Helper function to add field tokens and corresponding NER tags dynamically."""
        value_tokens = value.split()
        tokens.extend(value_tokens)
        ner_tags.extend([label] * len(value_tokens))

    # Prepend fixed values
    fixed_tokens = ["Indian", "Union", "Driving", "Licence", "Issued", "by", "Government", "of", "Kerala"]
    fixed_tags = [18] * len(fixed_tokens)  # Mark them as "OTHER"
    
    tokens.extend(fixed_tokens)
    ner_tags.extend(fixed_tags)

    # Add fields dynamically
    tokens.extend(["DL", "No."])
    ner_tags.extend([18, 18])

    add_field(5, dl_number)  # DL Number

    tokens.extend(["Issue", "Date:"])
    ner_tags.extend([6, 18])
    add_field(6, issue_date)  # Issue Date

    tokens.extend(["Validity", "(NT):"])
    ner_tags.extend([7, 18])
    add_field(7, validity_nt)  # Validity (NT)

    tokens.extend(["Validity", "(TR):"])
    ner_tags.extend([8, 18])
    add_field(8, validity_tr)  # Validity (TR)

    tokens.extend(["Date", "of", "First", "Issue:"])
    ner_tags.extend([16, 18, 16, 16])
    add_field(16, date_of_first_issue)  # Date of First Issue

    tokens.append("Name:")
    ner_tags.append(18)
    add_field(0, full_name)  # Name

    tokens.extend(["Date", "Of", "Birth:"])
    ner_tags.extend([18, 18, 3])
    add_field(3, dob)  # Date of Birth

    tokens.extend(["Blood", "Group:"])
    ner_tags.extend([18, 13])
    add_field(13, blood_group)  # Blood Group

    tokens.extend(["Organ", "Donor:"])
    ner_tags.extend([18, 14])
    add_field(14, organ_donor)  # Organ Donor

    tokens.extend(["S", "/", "D", "/", "W", "of:"])
    ner_tags.extend([15, 15, 15, 15, 15, 18])
    add_field(15, parent_spouse_name)  # Guardian (S/D/W of)

    tokens.extend(["Emergency", "Contact:"])
    ner_tags.extend([18, 17])
    add_field(17, emergency_contact)  # Emergency Contact

    tokens.extend(["Permanent", "Address:"])
    ner_tags.extend([18, 1])
    add_field(1, address)  # Permanent Address

    tokens.extend(["Present", "Address:"])
    ner_tags.extend([18, 2])
    add_field(2, address)  # Present Address

    tokens.extend(["Class", "of", "Vehicle:"])
    ner_tags.extend([18, 18, 18])
    add_field(9, "-")  # Class of Vehicle (Now just "-")

    tokens.extend(["COV", "Code:"])
    ner_tags.extend([9, 18])
    add_field(9, " ".join(cov_codes))  # COV Code (Now dynamic, multiple values)

    tokens.extend(["Issued", "By:"])
    ner_tags.extend([10, 18])
    add_field(10, issued_by)  # Issued By

    tokens.extend(["Badge", "Number:"])
    ner_tags.extend([11, 18])
    add_field(11, badge_number)  # Badge Number

    tokens.extend(["Badge", "Date:"])
    ner_tags.extend([12, 18])
    add_field(12, badge_date)  # Badge Date

    tokens.extend(["Licensing", "Authority:"])
    ner_tags.extend([10, 18])
    add_field(10, licensing_authority)  # Licensing Authority

    return [tokens, ner_tags]

# CSV File Writing
filename = "synthetic_driving_license_ner.csv"

header = ["tokens", "ner_tags"]

with open(filename, "w", newline="", encoding="utf-8") as file:
    writer = csv.writer(file)
    writer.writerow(header)
    for _ in range(10000):  # Generates 10,000 entries
        writer.writerow(generate_license_entry())

print(f"Synthetic NER-tagged driving license data saved to {filename}")

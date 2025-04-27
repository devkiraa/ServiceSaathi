import csv
import random
import os
from faker import Faker
from datetime import datetime, timedelta

fake = Faker('en_IN')  # Ensures Indian-style names

label_map_aadhar = {
    0: "NAME",
    1: "ADDRESS",
    2: "DOB",
    3: "SEX",
    4: "AADHAAR_NUMBER",
    5: "DATE_OF_ISSUE",
    6: "DETAILS_AS_ON",
    7: "OTHER"
}

label_map_passport = {
    0: "GIVEN_NAME",
    1: "ADDRESS",
    2: "DOB",
    3: "SEX",
    4: "PASSPORT_NUMBER",
    5: "FILE_NUMBER",
    6: "SURNAME",
    7: "TYPE",
    8: "DATE_OF_ISSUE",
    9: "DATE_OF_EXPIRY",
    10: "NAME_OF_FATHER",
    11: "NAME_OF_MOTHER",
    12: "NAME_OF SPOUSE",
    13: "OLD_PASSPORT_NUMBER",
    14: "OLD_PASSPORT_DATE_OF_ISSUE",
    15: "OLD_PASSPORT_PLACE_OF_ISSUE",
    16: "NATIONALITY",
    17: "PLACE_OF_BIRTH",
    18: "OTHER"
}

label_map_pan = {
    0: "NAME",
    1: "ADDRESS",
    2: "DOB",
    3: "PAN_NUMBER",
    4: "NAME_OF_FATHER",
    5: "OTHER"
}

label_map_driving = {
    0: "NAME",
    1: "PERMENENT_ADDRESS",
    2: "PRESENT_ADDRESS",
    3: "DOB",
    4: "DL_NUMBER",
    5: "ISSUE_DATE",
    6: "VALIDITY_NT",
    7: "VALIDITY_TR",
    8: "DATE_OF_FIRST_ISSUE",
    9: "BLOOD_GROUP",
    10: "S/D/W_OF",
    11: "ORGAN_DONOR",
    12: "EMERGENCY_NUMBER",
    13: "COV_CODE",
    14: "ISSUED_BY",
    15: "BADGE_NUMBER",
    16: "BADGE_DATE",
    17: "LICENSING_AUTHORITY",
    18: "OTHER",
}

label_map_voter = {
    0: "NAME",
    1: "ADDRESS",
    2: "DOB",
    3: "VOTER_ID",
    4: "NAME_OF_FATHER",
    5: "GENDER",
    6: "ISSUE_DATE",
    7: "OTHER",
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
    return f"{random.randint(1, 100)} - {fake.city().upper()}"

def shuffle_fixed_tokens(tokens, tags, fixed_tokens, fixed_tags):
    """ Randomly distributes fixed tokens while keeping other tokens and their labels intact. """
    shuffled_fixed = list(zip(fixed_tokens, fixed_tags))
    random.shuffle(shuffled_fixed)

    structured_data = list(zip(tokens, tags))
    random.shuffle(structured_data)

    shuffled_tokens, shuffled_tags = zip(*structured_data) if structured_data else ([], [])

    shuffled_tokens = list(shuffled_tokens)
    shuffled_tags = list(shuffled_tags)

    final_tokens = []
    final_tags = []
    fixed_index = 0

    for i in range(len(shuffled_tokens)):
        final_tokens.extend(shuffled_tokens[i])
        
        if isinstance(shuffled_tags[i], (list, tuple)): 
            final_tags.extend(shuffled_tags[i])
        else:
            final_tags.append(shuffled_tags[i])  

        num_to_insert = random.randint(1, 2)
        for _ in range(num_to_insert):
            if fixed_index < len(shuffled_fixed):
                token, tag = shuffled_fixed[fixed_index]
                final_tokens.append(token)
                final_tags.append(tag)
                fixed_index += 1

    while fixed_index < len(shuffled_fixed):
        token, tag = shuffled_fixed[fixed_index]
        final_tokens.append(token)
        final_tags.append(tag)
        fixed_index += 1

    return final_tokens, final_tags


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

    # Prepend fixed header information
    fixed_tokens = ["ELECTION", "COMMISSION", "OF", "INDIA", "Elector's", "Photo", "Identity", "Card",
        "Before", "every", "Election,", "please", "check", "that", "your", "name", "exists", 
        "in", "the", "current", "electorial", "roll.", "This", "card", "is", "not", "a", "proof", 
        "of", "age", "except", "for", "purpose", "of", "Election.", "1950", "www.ceo.kerala.gov.in"]
    fixed_tags = [7] * len(fixed_tokens)  # Mark as IGNORED

    # Voter ID
    tokens.append(["Voter", "ID:", voter_id])
    ner_tags.append([7, 7, 3])

    # Full Name
    tokens.append(["Name:", *full_name.split()])
    ner_tags.append([7, *([0] * len(full_name.split()))])

    # Father's Name
    tokens.append(["Father's", "Name:", *father_name.split()])
    ner_tags.append([5, 5, *([4] * len(father_name.split()))])

    # Gender
    tokens.append(["Gender:", gender])
    ner_tags.append([7, 5])

    # Date of Birth
    tokens.append(["Date", "of", "Birth:", dob])
    ner_tags.append([7, 7, 7, 2])

    # Address
    tokens.append(["Address:", *address.split()])
    ner_tags.append([7, *([1] * len(address.split()))])

    # Issue Date
    tokens.extend(["Issue", "Date:", issue_date])
    ner_tags.extend([7, 7, 6])

    # Electoral Registration Officer
    tokens.extend(["Electoral", "Registration", "Officer:", *electoral_officer.split()])
    ner_tags.extend([7, 7, 7, *([7] * len(electoral_officer.split()))])

    tokens, ner_tags = shuffle_fixed_tokens(tokens, ner_tags, fixed_tokens, fixed_tags)

    return [tokens, ner_tags, "Voter ID"]

# Function to generate a synthetic driving license entry with dynamic NER tags
def generate_license_entry():
    issue_date = fake.date_between(start_date="-10y", end_date="today").strftime('%d-%m-%Y')
    issue_date_dt = datetime.strptime(issue_date, '%d-%m-%Y')  # Convert to datetime
    validity_nt = (issue_date_dt + timedelta(days=20 * 365)).strftime('%d-%m-%Y')  # Add 20 years
    validity_tr = validity_nt  # Assuming same validity for TR
    dl_number = f"KL{random.randint(1, 99):02d} {random.randint(2023000000, 2023999999)}"

    full_name = generate_full_name()  # Ensuring dynamic name length
    
    dob = fake.date_of_birth(minimum_age=18, maximum_age=60).strftime('%d-%m-%Y')
    blood_group = random.choice(["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"])
    organ_donor = random.choice(["Yes", "No"])

    parent_spouse_name = generate_full_name()

    permenent_address = generate_address()
    present_address = generate_address()
    
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

    # Tokenization & NER tagging
    tokens = []
    ner_tags = []

    # Prepend fixed values
    fixed_tokens = ["Indian", "Union", "Driving", "Licence", "Issued", "by", "Government", "of", "Kerala"]
    fixed_tags = [18] * len(fixed_tokens)  # Mark them as "OTHER"
    
    # Add fields dynamically
    tokens.append(["DL", "No.", dl_number])
    ner_tags.append([18, 18, 4])

    tokens.append(["Issue", "Date:", issue_date])
    ner_tags.append([18, 18, 5])

    tokens.append(["Validity", "(NT):", validity_nt])
    ner_tags.append([18, 18, 6])

    tokens.append(["Validity", "(TR):", validity_tr])
    ner_tags.append([18, 18, 7])

    tokens.append(["Date", "of", "First", "Issue:", date_of_first_issue])
    ner_tags.append([18, 18 ,18, 18, 8])

    tokens.append(["Name:", *full_name.split()])
    ner_tags.append([18, *([0] * len(full_name.split()))])

    tokens.append(["Date", "Of", "Birth:", dob])
    ner_tags.append([18, 18, 18, 3])

    tokens.append(["Blood", "Group:", blood_group])
    ner_tags.append([18, 18, 8])

    tokens.append(["Organ", "Donor:", organ_donor])
    ner_tags.append([18, 18, 11])

    tokens.append(["S", "/", "D", "/", "W", "of:", parent_spouse_name])
    ner_tags.append([18, 18, 18, 18, 18, 18, 10])

    tokens.append(["Emergency", "Contact:", emergency_contact])
    ner_tags.append([18, 18, 12])

    tokens.append(["Permenent","Address:", *permenent_address.split()])
    ner_tags.append([18, 18, *([1] * len(permenent_address.split()))])  # Permanent Address

    tokens.append(["Present", "Address:", *present_address.split()])
    ner_tags.append([18, 18, *([2] * len(present_address.split()))]) # Present Address

    tokens.append(["Class", "of", "Vehicle:", "-"])
    ner_tags.append([18, 18, 18, 18]) # Class of Vehicle (Now just "-")

    tokens.append(["COV", "Code:", *(" ".join(cov_codes)).split()])
    ner_tags.append([18, 18, *([13] * len((" ".join(cov_codes)).split()))])  # COV Code (Now dynamic, multiple values)

    tokens.append(["Issued", "By:", issued_by])
    ner_tags.append([18, 18, 14])  # Issued By

    tokens.append(["Badge", "Number:", badge_number])
    ner_tags.append([18, 18, 15])  # Badge Number

    tokens.append(["Badge", "Date:", badge_date])
    ner_tags.append([18, 18, 16])  # Badge Date

    tokens.append(["Licensing", "Authority:", *licensing_authority.split()])
    ner_tags.append([18, 18, *([17] * len(present_address.split()))])  # Licensing Authority

    tokens, ner_tags = shuffle_fixed_tokens(tokens, ner_tags, fixed_tokens, fixed_tags)

    return [tokens, ner_tags, "Driving License"]

def generate_pan_entry():
    pan_number = fake.random_uppercase_letter() + fake.random_uppercase_letter() + \
                 fake.random_uppercase_letter() + fake.random_uppercase_letter() + \
                 fake.random_uppercase_letter() + str(random.randint(1000, 9999)) + \
                 fake.random_uppercase_letter()
    
    full_name = generate_full_name()  # Varying number of words in name
    father_name = generate_full_name()  # Varying number of words in father's name
    dob = fake.date_of_birth(minimum_age=18, maximum_age=60).strftime('%d/%m/%Y')
    
    # Tokenization & NER tagging
    tokens = []
    ner_tags = []
    
    # Fixed Text
    fixed_tokens = ["Income", "Tax", "Department", "Permanent", "Account", "Number", "Card", "Government", "of", "India"]
    fixed_tags = [5] * len(fixed_tokens)  # Mark as "OTHER"
    
    tokens.append([pan_number])
    ner_tags.append([3])

    tokens.append(["Name:", *full_name.split()])
    ner_tags.append([5, *([0] * len(full_name.split()))])
    
    tokens.append(["Father's", "Name:", *father_name.split()])
    ner_tags.append([5, 5, *([4] * len(father_name.split()))])
    
    tokens.append(["Date", "of", "Birth:", dob])
    ner_tags.append([5, 5, 5, 2])

    tokens, ner_tags = shuffle_fixed_tokens(tokens, ner_tags, fixed_tokens, fixed_tags)
    
    return [tokens, ner_tags, "PAN Card"]

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
    
    tokens = []
    ner_tags = []

    # Prepend fixed values
    fixed_tokens = ["Republic", "of", "India"]
    fixed_tags = [18] * len(fixed_tokens)  # Mark them as "OTHER"

    tokens.append(["Code:", "IN"])
    ner_tags.append([18, 18])

    tokens.append(["Nationality:", nationality])
    ner_tags.append([18, 15])

    tokens.append(["Type:", type_value])
    ner_tags.append([18, 7])

    tokens.append(["File", "Number:", type_value])
    ner_tags.append([18, 18, 5])

    tokens.append(["Passport", "No:", passport_no])
    ner_tags.append([18, 18, 4])

    tokens.append(["Surname:", surname])
    ner_tags.append([18, 6])

    tokens.append(["Given", "Name:", *given_name.split()])
    ner_tags.append([18, 18, *([0] * len(given_name.split()))])

    tokens.append(["Date", "of", "Birth", dob])
    ner_tags.append([18, 18, 18, 2])

    tokens.append(["Sex:", sex])
    ner_tags.append([18, 3])

    tokens.append(["Place", "of", "Birth", place_of_birth])
    ner_tags.append([18, 18, 18, 17])

    tokens.append(["Date", "of", "Issue", date_of_issue])
    ner_tags.append([18, 18, 18, 8])

    tokens.append(["Date", "of", "Expiry", date_of_expiry])
    ner_tags.append([18, 18, 18, 9])

    tokens.append(["Name", "of", "Father/Legal", "Guardian:", *father_name.split()])
    ner_tags.append([18, 18, 18, 18, *([10] * len(father_name.split()))])

    tokens.append(["Name", "of", "Mother:", *mother_name.split()])
    ner_tags.append([18, 18, 18, *([11] * len(mother_name.split()))])

    tokens.append(["Name", "of", "Spouse:", *spouse_name.split()])
    ner_tags.append([18, 18, 18, *([12] * len(spouse_name.split()))])

    tokens.append(["Address:", *address.split()])
    ner_tags.append([18, *([1] * len(address.split()))])

    tokens.append(["Old", "Passport", "No:", old_passport_no])
    ner_tags.append([18, 18, 18, 13])

    tokens.append(["Old", "Passport", "date", "of", "Issue:", old_passport_issue_date])
    ner_tags.append([18, 18, 18, 18, 18, 14])

    tokens.append(["Old", "Passport", "place", "of", "Issue:", old_passport_place])
    ner_tags.append([18, 18, 18, 18, 18, 15])

    tokens, ner_tags = shuffle_fixed_tokens(tokens, ner_tags, fixed_tokens, fixed_tags)

    return [tokens, ner_tags, "Passport"]

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

    # Static Aadhaar text
    fixed_tokens = [
        "Aadhaar", "no:", "भारत", "सरकार", "Government", "of", "India", 
        "आधार", "Aadhaar", "is", "proof", "of", "identity,", "not", "of",
        "citizenship", "or", "date", "of", "birth."
    ]
    fixed_tags = [7] * len(fixed_tokens)

    tokens.append(["issued:", issue_date])
    ner_tags.append([7, 5])

    tokens.append(["DOB:", dob])
    ner_tags.append([7, 2])

    tokens.append(["Sex:", sex])
    ner_tags.append([7, 3])

    tokens.append(["Aadhaar", "no.", "issued:", aadhaar_number])
    ner_tags.append([7, 7, 7, 4])

    # Add dynamic fields
    tokens.append(["Name:", *full_name.split()])
    ner_tags.append([7, *([0] * len(full_name.split()))])

    tokens.append(["Address:", *address.split()])
    ner_tags.append([7, *([1] * len(address.split()))])

    tokens.append(["Details", "as", "on:", issue_date])
    ner_tags.append([7, 7, 7, 6])

    tokens, ner_tags = shuffle_fixed_tokens(tokens, ner_tags, fixed_tokens, fixed_tags)

    return [tokens, ner_tags, "Aadhaar"]

def new_data():
    # CSV File Writing
    filename = "synthetic_combined_ner_S.csv"

    # Function to check if the file exists
    file_exists = os.path.exists(filename)

    # Number of new entries to generate
    num_entries = 100000

    # Open file in append mode ('a' for appending, 'w' for overwriting)
    with open(filename, "a", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)

        # Write the header only if the file is newly created
        if not file_exists:
            writer.writerow(["tokens", "ner_tags", "type"])

        # Generate and append new entries
        for _ in range(8500):  # Generates 10,000 entries
            writer.writerow(generate_aadhaar_entry())

        # Generate and append new entries
        for _ in range(9200):  # Generates 10,000 entries
            writer.writerow(generate_pan_entry())

        # Generate and append new entries
        for _ in range(10800):  # Generates 10,000 entries
            writer.writerow(generate_license_entry())

        # Generate and append new entries
        for _ in range(11500):  # Generates 10,000 entries
            writer.writerow(generate_passport_entry())

        # Generate and append new entries
        for _ in range(7600):  # Generates 10,000 entries
            writer.writerow(generate_voter_entry())

        # Generate and append new entries
        for _ in range(9700):  # Generates 10,000 entries
            writer.writerow(generate_passport_entry())

        # Generate and append new entries
        for _ in range(10300):  # Generates 10,000 entries
            writer.writerow(generate_voter_entry())

        # Generate and append new entries
        for _ in range(8900):  # Generates 10,000 entries
            writer.writerow(generate_license_entry())

        # Generate and append new entries
        for _ in range(12200):  # Generates 10,000 entries
            writer.writerow(generate_aadhaar_entry())

        # Generate and append new entries
        for _ in range(11300):  # Generates 10,000 entries
            writer.writerow(generate_pan_entry())

    print(f"✅ {num_entries} new synthetic NER-tagged document entries appended to {filename}")

new_data()
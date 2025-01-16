import pymysql
import pandas as pd
import webbrowser
import os
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sqlalchemy import create_engine
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Database connection
def get_donor_data():
    # Create SQLAlchemy engine using environment variables
    engine = create_engine(f"mysql+pymysql://{os.getenv('USER')}:{os.getenv('PASSWORD')}@{os.getenv('HOST')}/{os.getenv('DATABASE')}")
    query = "SELECT donor_name, phone_no, date_of_birth, gender, don_address, weight, blood_pressure, iron_content FROM donor"
    donor_data = pd.read_sql(query, engine)
    return donor_data

def preprocess_data(donor_data):
    donor_data = donor_data.copy()

    # Convert date_of_birth to age
    donor_data['age'] = pd.to_datetime('today').year - pd.to_datetime(donor_data['date_of_birth']).dt.year

    # Drop unnecessary columns but keep relevant ones
    donor_data = donor_data.drop(columns=['date_of_birth', 'phone_no', 'don_address'])

    # Encode gender as binary
    donor_data['gender'] = donor_data['gender'].map({'M': 0, 'F': 1})
    donor_data['gender'] = donor_data['gender'].fillna(-1)  # Fill NaN values with a default value

    # Define eligibility (target variable)
    donor_data['eligible'] = ((donor_data['age'] > 18) &
                              (donor_data['weight'] > 50) &
                              (donor_data['blood_pressure'] < 120) &
                              (donor_data['iron_content'] > 12)).astype(int)

    # Separate features and target
    X = donor_data[['age', 'gender', 'weight', 'blood_pressure', 'iron_content']]
    y = donor_data['eligible']

    return X, y, donor_data

def train_model(X, y):
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)
    model = RandomForestClassifier(random_state=42)
    model.fit(X_train, y_train)
    return model, X_test

def generate_html_output(model, X, donor_data):
    # Predict eligibility for all donors
    predictions = model.predict(X)

    # Add predictions to the original donor data
    donor_data['Eligibility'] = predictions
    donor_data['Eligibility'] = donor_data['Eligibility'].map({0: "Not Eligible", 1: "Eligible"})

    # Map gender back to original values for display
    donor_data['gender'] = donor_data['gender'].map({0: "Male", 1: "Female", -1: "Unknown"})

    # Save the updated dataset as an HTML file
    html_file = "donor_data_with_eligibility.html"
    html_content = donor_data.to_html(index=False, classes='table table-bordered', border=0)
    with open(html_file, "w") as file:
        file.write("""
        <html>
        <head>
            <title>Donor Data with Eligibility</title>
            <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">
        </head>
        <body>
            <div class="container">
                <h2 class="text-center mt-4">Donor Data with Eligibility</h2>
                """ + html_content + """
            </div>
        </body>
        </html>
        """)

    # Open the file in the default web browser
    webbrowser.open(html_file)

# Main execution
if __name__ == "__main__":
    # Step 1: Get donor data
    donor_data = get_donor_data()

    # Step 2: Preprocess data
    X, y, donor_data = preprocess_data(donor_data)

    # Step 3: Train the model
    model, X_test = train_model(X, y)

    # Step 4: Generate HTML output with eligibility
    generate_html_output(model, X, donor_data)

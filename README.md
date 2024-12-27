

# Blood Donation System

## Description

The Blood Donation System is a Node.js application that utilizes MySQL to manage donor and patient information. It provides a simple interface to add donors and patients, check blood availability, generate bills, and maintain a database of blood donors.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [Features](#features)
- [Contributing](#contributing)
- [License](#license)

## Installation

Before running the application, ensure that you have Node.js and MySQL installed on your machine. Follow the steps below to set up the project:

1. **Node.js**: If you don't have Node.js installed, download and install it from [https://nodejs.org/](https://nodejs.org/).

2. **MySQL**: Install MySQL on your machine. You can download it from [https://www.mysql.com/](https://www.mysql.com/).

3. **Clone the repository**:

   ```bash
   git clone https://github.com/your-username/blood-donation-system.git
   cd blood-donation-system
   ```

4. **Install dependencies**:

   ```bash
   npm install
   ```

5. **Start MySQL Server**:

   - For Windows:

     ```bash
     # Start MySQL server
     net start mysql
     ```

   - For Linux:

     ```bash
     # Start MySQL server
     sudo service mysql start
     ```

6. **Configure the database**:

   - Create a MySQL database named `mysql` (you can choose a different name if you prefer).
   
     ```sql
     CREATE DATABASE IF NOT EXISTS mysql;
     USE mysql;
     ```

   - Update the configuration in `config.js` with your database details.

7. **Run the application**:

   ```bash
   node app.js
   ```

## Usage

To use the Blood Donation System:

1. Open your web browser and go to [http://localhost:3000/](http://localhost:3000/) to access the homepage.

2. To navigate to the admin route, visit [http://localhost:3000/admin](http://localhost:3000/admin).

3. Add donors and patients as follows:

   - Add donor: Click on the "Add Donor" button on the homepage, enter the donor details, and submit the form.

   - Add patient: Navigate to [http://localhost:3000/](http://localhost:3000/), click on the "Add Patient" button, enter patient details, and submit the form.

4. Check blood availability:

   - Navigate to [http://localhost:3000/](http://localhost:3000/), enter patient details, and the system will display a donor list if the patient is present in the database.

5. Generate bills:

   - After selecting a donor, a bill will be generated, and the donor and blood details will be removed from the database.

## Features

- **Add Donor**: Ability to add information about blood donors.
- **Add Patient**: Ability to add information about patients.
- **Check Blood Availability**: Check if a particular blood type is available for a given patient.
- **Generate Bills**: Generate bills for blood donations and remove donor and blood details from the database.

## Contributing

If you'd like to contribute to this project, please follow the guidelines outlined in the [CONTRIBUTING.md](CONTRIBUTING.md) file.

## License

This project is licensed under the [MIT License](LICENSE).

const mysql = require('mysql');

// MySQL Database connection pool configuration



// const pool = mysql.createPool({
//   connectionLimit: 10,
//   host: '127.0.0.1',
//   user: 'noob',
//   password: 'admin@123',
//   database: 'blood_bank',
// });


const pool = mysql.createPool({
  connectionLimit: 10,
  host: process.env.HOST,
  user: process.env.USER,
  password: process.env.PASSWORD,
  database: process.env.DATABASE,
});




/// Create 'doctor' table if not exists
const createDoctorTableQuery = `
CREATE TABLE IF NOT EXISTS doctor (
  id INT AUTO_INCREMENT PRIMARY KEY,
  doctor_name VARCHAR(255) NOT NULL,
  specialization VARCHAR(255),
  clinic_address VARCHAR(255),
  phone_no VARCHAR(15) NOT NULL,
  doc_email VARCHAR(100) NOT NULL
)
`;


// Create 'donor' table if not exists
const createDonorTableQuery = `
CREATE TABLE IF NOT EXISTS donor (
  id INT AUTO_INCREMENT PRIMARY KEY,
  donor_name VARCHAR(255) NOT NULL,
  phone_no VARCHAR(15) NOT NULL,
  d_email VARCHAR(100) NOT NULL,
  date_of_birth DATE,
  gender VARCHAR(10),
  don_address VARCHAR(255),
  weight FLOAT CHECK (weight > 0),
  blood_pressure FLOAT CHECK (blood_pressure > 0),
  iron_content FLOAT CHECK (iron_content > 0),
  blood_type VARCHAR(5),
  last_donation_date DATE,
  doctor_id INT,
  FOREIGN KEY (doctor_id) REFERENCES doctor(id) ON DELETE CASCADE
)
`;


// Create 'receiver' table if not exists
const createReceiverTableQuery = `
CREATE TABLE IF NOT EXISTS receiver (
  receiver_id INT NOT NULL AUTO_INCREMENT,
  receiver_name VARCHAR(20),
  r_phno VARCHAR(255),
  r_email VARCHAR(100),
  hospital_address VARCHAR(50),
  r_address VARCHAR(50),
  blood_type VARCHAR(20),
  urgency_level ENUM('High', 'Medium', 'Low') DEFAULT 'Medium',
  PRIMARY KEY (receiver_id)
)
`;

const createBloodBankTableQuery = `
CREATE TABLE IF NOT EXISTS blood_bank (
  blood_bank_id INT AUTO_INCREMENT PRIMARY KEY,
  blood_bank_name VARCHAR(255) NOT NULL,
  bb_address VARCHAR(255),
  contact_number VARCHAR(15),
  bb_email VARCHAR(100),
  manager_name VARCHAR(255) NOT NULL,
  operating_hours VARCHAR(255) NOT NULL
)
`;

const createBloodTableQuery = `
CREATE TABLE IF NOT EXISTS blood (
  blood_type VARCHAR(20),
  donor_id INT,
  blood_bank_id INT,
  PRIMARY KEY (donor_id),
  blood_date DATE,
  FOREIGN KEY (donor_id) REFERENCES donor(id) ON DELETE CASCADE,
  FOREIGN KEY (blood_bank_id) REFERENCES blood_bank(blood_bank_id) ON DELETE CASCADE
)
`;

const createBloodDeliveryTableQuery = `
CREATE TABLE IF NOT EXISTS blood_delivery (
  delivery_id INT AUTO_INCREMENT PRIMARY KEY,
  delivery_date DATE,
  donor_id INT,
  receiver_id INT,
  blood_type VARCHAR(20),
  blood_bank_id INT
)
`;



// Execute table creation queries
executeQuery(createDoctorTableQuery, null, 0);
executeQuery(createDonorTableQuery, null, 0);
executeQuery(createBloodBankTableQuery, null, 0);
executeQuery(createBloodTableQuery, null, 0);
executeQuery(createReceiverTableQuery, null, 0);
executeQuery(createBloodDeliveryTableQuery, null, 0);






function executeQuery(query, res, callback, retryCount = 3) {
  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting MySQL connection:', err.message);
      // Retry logic
      if (retryCount > 0) {
        console.log(`Retrying (${retryCount} attempts left)`);
        executeQuery(query, res, callback, retryCount - 1);
      } else if (res) {
        res.status(500).send('Error getting MySQL connection');
      }
      return;
    }

    connection.query(query, (error, results) => {
      connection.release(); // Release the connection back to the pool

      if (error) {
        console.error('Error executing query:', error.message);
        // Retry logic
        if (retryCount > 0) {
          console.log(`Retrying (${retryCount} attempts left)`);
          executeQuery(query, res, callback, retryCount - 1);
        } else if (res) {
          res.status(500).send('Error executing query');
        }
        return;
      }

      console.log('Query executed successfully');
      // Invoke the callback with the results
      if (typeof callback === 'function') {
        callback(results);
      } else if (res) {
        res.redirect('/index');
      }
    });
  });
}


module.exports = { mysql, pool, executeQuery }
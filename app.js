const express = require('express');
require("dotenv").config()
const bodyParser = require('body-parser');
const path = require("path")
const fs = require('fs');
const { log } = require('console');
const puppeteer = require('puppeteer');


const { Donorfeedback, Admin } = require("./DB/mongodb")

const { mysql, pool, executeQuery } = require("./DB/mysql")

const app = express();
const port = 3000;
const temporaryStorage = [];

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'public', 'Front-end'));

app.use(express.static(path.join(__dirname, 'public', 'Front-end')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

Admin.create({username:"test",password:"test123"})

async function AdminAuth(req, res, next) {
    

    await Admin.findOne({ username: req.body.username, password: req.body.password }).then((data) => {

        if (!data) {
            res.status(404).json({ message: "User not found or Incorrect Password" })
        }
        else {
            
            next()

        }
    })


}
async function query(data) {
	const response = await fetch(
		"https://router.huggingface.co/hf-inference/models/philschmid/bart-large-cnn-samsum",
		{
			headers: {
				Authorization: `Bearer ${process.env.HF_API_KEY}`,
				"Content-Type": "application/json",
			},
			method: "POST",
			body: JSON.stringify(data),
		}
	);
	const result = await response.json();
	return result;
}

app.get("/admin", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "Front-end", "admin_auth.html"));

})

app.get('/api/donor/:donorId', async (req, res) => {
    try {
        const donorId = req.params.donorId;
        const donor = await Donorfeedback.findOne({ key: donorId });

        if (donor) {
            res.json(donor);
        } else {
            res.status(404).json({ error: 'Donor not found' });
        }
    } catch (error) {
        console.error('Error finding donor:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post("/admin", AdminAuth, (req, res) => {
    res.sendFile(path.join(__dirname, "public", "Front-end", "admin.html"));
})

app.get("/donor", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "Front-end", "donor.html"));
})
app.post('/donor', async (req, res) => {
  const {
    donor_name,
    phone_no,
    date_of_birth,
    gender,
    don_address,
    weight,
    blood_pressure,
    iron_content,
    doctor_id,
    blood_bank_id,
    blood_type,
    last_donation_date,
    d_email,
    chiefComplaint,
    medicalHistory,
    meds,
    allergies,
    familyHistory,
    socialHistory
  } = req.body;

  // Insert into donor table
  const donorQuery = `
    INSERT INTO donor (donor_name, phone_no, date_of_birth, gender, don_address, weight, blood_pressure, iron_content, doctor_id, d_email, blood_type, last_donation_date)
    VALUES ('${donor_name}', '${phone_no}', '${date_of_birth}', '${gender}', '${don_address}', '${weight}', '${blood_pressure}', '${iron_content}', '${doctor_id}', '${d_email}', '${blood_type}', '${last_donation_date}')
  `;

  let id;
  executeQuery(donorQuery, res, async (donorResult) => {
    id = donorResult.insertId;
    console.log('Inserted donor ID:', id);

    // Now you can use donorId for further operations
    const bloodQuery = `
      INSERT INTO blood (blood_bank_id, blood_type, donor_id, blood_date)
      VALUES ('${blood_bank_id}', '${blood_type}', '${id}', '${last_donation_date}');
    `;

    const patientData = {
      patientName: req.body.donor_name,
      date_of_birth: req.body.date_of_birth,
      sex: req.body.gender,
      mrn: req.body.phone_no,
      chiefComplaint: req.body.chiefComplaint.split(','),
      medicalHistory: req.body.medicalHistory.split(','),
      meds: req.body.meds.split(','),
      allergies: req.body.allergies.split(','),
      familyHistory: req.body.familyHistory.split(','),
      socialHistory: req.body.socialHistory,
    };

    // Render the template
    const template = `[Patient Name]: ${patientData.patientName}
[Date of Birth]: ${patientData.date_of_birth}
[Gender]: ${patientData.sex}
[Mobile Number]: ${patientData.mrn}

**Chief Complaint:**
${patientData.chiefComplaint.join('\n')}

**Medical History:**
${patientData.medicalHistory.map(item => `- ${item}`).join('\n')}

**Meds:**
${patientData.meds.join('\n')}

**Allergies:**
${patientData.allergies.length > 0 ? patientData.allergies.map(item => `- ${item}`).join('\n') : 'None reported.'}

**Family History:**
${patientData.familyHistory.map(item => `- ${item}`).join('\n')}

**Social History:**
${patientData.socialHistory}

Summarize these points.`;

        // console.log(template);
        // 
        const huggingFaceResponse = await query({ "inputs": template }).then((response) => {
            // console.log(JSON.stringify(response));
            return response;
        });

        // Process the Hugging Face API response as needed
        if (huggingFaceResponse && huggingFaceResponse.length > 0) {
            console.log(huggingFaceResponse[0].summary_text);
            Donorfeedback.create({ key: id, report: huggingFaceResponse[0].summary_text });
        } else {
            console.error('Hugging Face API response is empty or invalid');
        }

        // Execute the blood query
        executeQuery(bloodQuery, res);
    });


});

app.get("/patient", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "Front-end", "patient.html"));

})

app.post("/patient", (req, res) => {
    const { receiver_name, r_phno, r_email, hospital_address, r_address, blood_type, blood_bank_id, urgency_level } = req.body;

    // Get the date 45 days ago from the current date
    const fortyFiveDaysAgo = new Date();
    fortyFiveDaysAgo.setDate(fortyFiveDaysAgo.getDate() - 45);
    const formattedDate = fortyFiveDaysAgo.toISOString().split('T')[0]; // Format the date as YYYY-MM-DD

    // Check if the required blood is present in the specified blood bank and within the last 45 days
    const checkBloodAvailabilityQuery = `
      SELECT donor.id, donor.donor_name, donor.phone_no, donor.don_address as donor_address, blood.blood_type, blood_bank.blood_bank_name
      FROM blood
      JOIN donor ON blood.donor_id = donor.id
      JOIN blood_bank ON blood.blood_bank_id = blood_bank.blood_bank_id
      WHERE blood.blood_type = ? 
      AND blood.blood_bank_id = ? 
      AND blood.blood_date >= '${formattedDate}'
    `;

    pool.query(checkBloodAvailabilityQuery, [blood_type, blood_bank_id], (error, donorResults) => {
        if (error) {
            console.error('Error checking blood availability:', error);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }

        if (donorResults.length > 0) {
            // Blood is available, provide details of matching donors
            const donorDetails = donorResults.map((donor) => ({
                donor_id: donor.id,
                donor_name: donor.donor_name,
                phone_no: donor.phone_no,
                donor_address: donor.donor_address,
                blood_type: donor.blood_type,
                blood_bank_name: donor.blood_bank_name,
            }));

            // Save receiver details only when the donor is available
            const savePatientQuery = `
                INSERT INTO receiver (receiver_name, r_phno, r_email, hospital_address, r_address, blood_type, urgency_level)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;

            pool.query(savePatientQuery, [receiver_name, r_phno, r_email, hospital_address, r_address, blood_type, urgency_level], (savePatientError, savePatientResults) => {
                if (savePatientError) {
                    console.error('Error saving receiver details:', savePatientError);
                    res.status(500).json({ error: 'Internal Server Error' });
                    return;
                }

                // Redirect to the /selectDonor route with patient and donor details as query parameters
                res.redirect(`/selectDonor?receiver_name=${encodeURIComponent(receiver_name)}&r_phno=${encodeURIComponent(r_phno)}&r_email=${encodeURIComponent(r_email)}&hospital_address=${encodeURIComponent(hospital_address)}&r_address=${encodeURIComponent(r_address)}&blood_type=${encodeURIComponent(blood_type)}&urgency_level=${encodeURIComponent(urgency_level)}&donorDetails=${encodeURIComponent(JSON.stringify(donorDetails))}`);
            });
        } else {
            // Blood is not available in the specified blood bank for the required type within the last 45 days
            res.send(`
                <p>Blood not available in the specified blood bank for the required type within the last 45 days.</p>
                <button onclick="window.history.back()">Go Back</button>
            `);
        }
    });
});

app.get("/selectDonor", (req, res) => {
    // console.log(req.query);
    temporaryStorage.push(req.query)
    res.sendFile(path.join(__dirname, "public", "Front-end", "selectDonor.html"));
})
app.post("/selectDonor", (req, res) => {
    const { donor_id } = req.body;

    // Fetch patient details from req.query
    const { receiver_name, r_phno, hospital_address, r_address, blood_type, donorDetails } = temporaryStorage.pop();
    const parsedDonorDetails = JSON.parse(decodeURIComponent(donorDetails));

    // Get details of the selected donor
    let selectedDonor;
    for (const donor of parsedDonorDetails) {
        if (String(donor.donor_id) === String(donor_id).trim()) {
            selectedDonor = donor;
            break;
        }
    }

    // Delete the row from the blood table where donor_id matches
    const deleteBloodQuery = `
      DELETE FROM blood
      WHERE donor_id = ?
    `;

    pool.query(deleteBloodQuery, [donor_id], (deleteError) => {
        if (deleteError) {
            console.error('Error deleting row from blood table:', deleteError);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }

        // Now, delete the donor details from the donor table
        const deleteDonorDetailsQuery = `
        DELETE FROM donor
        WHERE id = ?
      `;

        pool.query(deleteDonorDetailsQuery, [donor_id], (deleteDonorError) => {
            if (deleteDonorError) {
                console.error('Error deleting donor details:', deleteDonorError);
                res.status(500).json({ error: 'Internal Server Error' });
                return;
            }

            // Insert receiver details if not already present
            const insertReceiverQuery = `
                INSERT INTO receiver (receiver_name, r_phno, hospital_address, r_address, blood_type)
                VALUES (?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE receiver_name = receiver_name
            `;

            pool.query(insertReceiverQuery, [receiver_name, r_phno, hospital_address, r_address, blood_type], (insertReceiverError) => {
                if (insertReceiverError) {
                    console.error('Error inserting receiver details:', insertReceiverError);
                    res.status(500).json({ error: 'Internal Server Error' });
                    return;
                }

                // Fetch the receiver_id
                const patientIdQuery = `
                    SELECT receiver_id FROM receiver WHERE receiver_name = ? AND r_phno = ?
                `;

                pool.query(patientIdQuery, [receiver_name, r_phno], (error, results) => {
                    if (error) {
                        console.error('Error fetching receiver_id:', error);
                        res.status(500).json({ error: 'Internal Server Error' });
                        return;
                    }

                    // Extract receiver_id from the results if available
                    const receiver_id = results.length > 0 ? results[0].receiver_id : null;

                    if (!receiver_id) {
                        console.error('Receiver not found or missing receiver_id');
                        res.status(404).json({ error: 'Receiver not found or missing receiver_id' });
                        return;
                    }

                    // Insert data into the blood_delivery table
                    const insertBloodDeliveryQuery = `
                        INSERT INTO blood_delivery (delivery_date, donor_id, receiver_id, blood_type, blood_bank_id)
                        VALUES (?, ?, ?, ?, ?)
                    `;

                    // Fetch the blood_bank_id based on the blood_bank_name
                    const bloodBankIdQuery = `
                        SELECT blood_bank_id FROM blood_bank WHERE blood_bank_name = ?
                    `;

                    pool.query(bloodBankIdQuery, [selectedDonor.blood_bank_name], (error, bloodBankResults) => {
                        if (error) {
                            console.error('Error fetching blood_bank_id:', error);
                            res.status(500).json({ error: 'Internal Server Error' });
                            return;
                        }

                        const blood_bank_id = bloodBankResults.length > 0 ? bloodBankResults[0].blood_bank_id : null;

                        if (!blood_bank_id) {
                            console.error('Blood bank not found or missing blood_bank_id');
                            res.status(404).json({ error: 'Blood bank not found or missing blood_bank_id' });
                            return;
                        }

                        // Execute the blood delivery insertion query with blood_type and blood_bank_id
                        pool.query(insertBloodDeliveryQuery, [new Date(), donor_id, receiver_id, blood_type, blood_bank_id], (error, results) => {
                            if (error) {
                                console.error('Error inserting data into blood_delivery table:', error);
                                res.status(500).json({ error: 'Internal Server Error' });
                                return;
                            } else {
                                console.log('Data inserted into blood_delivery table successfully.');
                                // Redirect to the /generateBill route with patient and donor details as query parameters
                                res.redirect(`/generateBill?receiver_name=${encodeURIComponent(receiver_name)}&r_phno=${encodeURIComponent(r_phno)}&hospital_address=${encodeURIComponent(hospital_address)}&r_address=${encodeURIComponent(r_address)}&donor_name=${encodeURIComponent(selectedDonor.donor_name)}&phone_no=${encodeURIComponent(selectedDonor.phone_no)}&don_address=${encodeURIComponent(selectedDonor.donor_address)}&blood_type=${encodeURIComponent(blood_type)}&blood_bank_name=${encodeURIComponent(selectedDonor.blood_bank_name)}`);
                            }
                        });
                    });
                });
            });
        });
    });
});


// app.get("/sendDonor", (req, res) => {
//     // Render the sendDonor.html file
//     res.sendFile(path.join(__dirname, "public", "Front-end", "sendDonor.html"));
// });

function checkAgreement(req, res, next) {
    // Render the check.html page
    res.sendFile(path.join(__dirname, "public", "Front-end", "index.html"));
}

// Handle POST request to '/check'
app.post('/check', (req, res) => {
    const agreementStatus1 = req.body.agreementStatus1;
    const agreementStatus2 = req.body.agreementStatus2;

    // Check if the user has agreed to both conditions
    if (agreementStatus1 && agreementStatus2) {
        // If both conditions are met, the user can proceed to donate blood
        res.send({ canDonateBlood: true });
    } else {
        // If any condition is not met, the user cannot donate blood
        res.status(400).send("Sorry, you cannot donate blood.");
    }
});




app.get('/', checkAgreement)

app.get('/index',(req,res)=>{
    res.sendFile(path.join(__dirname, "public", "Front-end", "check.html"));
})




app.post('/addDoctor', (req, res) => {
    const { doctor_name, specialization, clinic_address, phone_no, doc_email } = req.body;
  
    const query = `
      INSERT INTO doctor (doctor_name, specialization, clinic_address, phone_no, doc_email)
      VALUES ('${doctor_name}', '${specialization}', '${clinic_address}', '${phone_no}', '${doc_email}')
    `;
  
    executeQuery(query, res, (results) => {
        res.status(200).json({ message: 'Doctor added successfully' });
    });
  });
  


app.post('/bloodbank', (req, res) => {
    const { blood_bank_name, bb_address, contact_number, bb_email, manager_name, operating_hours } = req.body;
  
    const query = `
      INSERT INTO blood_bank (blood_bank_name, bb_address, contact_number, bb_email, manager_name, operating_hours)
      VALUES ('${blood_bank_name}', '${bb_address}', '${contact_number}', '${bb_email}', '${manager_name}', '${operating_hours}')
    `;
  
    executeQuery(query, res, (results) => {
      res.status(200).json({ message: 'Blood bank added successfully' });
    });
  });
  

app.get('/getDoctors', (req, res) => {
    const query = 'SELECT id, doctor_name FROM doctor';

    pool.query(query, (error, results) => {
        if (error) {
            console.error('Error fetching doctors:', error);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }

        res.json(results);
    });
});

app.get('/getBloodBank', (req, res) => {
    const query = 'SELECT blood_bank_id, blood_bank_name FROM blood_bank';

    pool.query(query, (error, results) => {
        if (error) {
            console.error('Error fetching doctors:', error);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }

        res.json(results);
    });
});


app.get('/generateBill', (req, res) => {
    const { receiver_name, r_phno, r_email, hospital_address, r_address, donor_name, phone_no, don_address, blood_type, blood_bank_name } = req.query;

    const generateBillTemplatePath = path.join(__dirname, 'public', 'Front-end', 'generateBill.html');
    fs.readFile(generateBillTemplatePath, 'utf-8', (err, data) => {
        if (err) {
            console.error('Error reading generateBill.html:', err);
            res.status(500).send('Internal Server Error');
            return;
        }

        const generateBillHtml = data
            .replace('{{receiver_name}}', receiver_name)
            .replace('{{r_phno}}', r_phno)
            .replace('{{r_email}}', r_email)
            .replace('{{hospital_address}}', hospital_address)
            .replace('{{r_address}}', r_address)
            .replace('{{donor_name}}', donor_name)
            .replace('{{phone_no}}', phone_no)
            .replace('{{don_address}}', don_address)
            .replace('{{blood_type}}', blood_type)
            .replace('{{blood_bank_name}}', blood_bank_name);

        res.send(generateBillHtml);
    });
});

app.get('/generateBill', async (req, res) => {
    const {
        receiver_name,
        r_phno,
        hospital_address,
        r_address,
        donor_id,
        blood_type,
        DonorDetails
    } = req.query;

    // Parse DonorDetails back into an object
    const parsedDonorDetails = JSON.parse(DonorDetails);

    // Access donor details from the parsed object
    const {
        donor_name,
        phone_no,
        donor_address,
        blood_bank_name
    } = parsedDonorDetails;

    // Get the current date in the format YYYY-MM-DD
    const currentDate = new Date().toISOString().split('T')[0];

    // Here you should fetch or generate the patient_id, let's assume it's fetched from the database

    // Fetch patient_id from the database or generate it dynamically
    const patientIdQuery = `
        SELECT receiver_id FROM receiver WHERE receiver_name = ? AND r_phno = ?
    `;

    pool.query(patientIdQuery, [receiver_name, r_phno], (error, results) => {
        if (error) {
            console.error('Error fetching receiver_id:', error);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }

        // Extract receiver_id from the results if available
        const receiver_id = results.length > 0 ? results[0].receiver_id : null;

        if (!receiver_id) {
            console.error('Receiver not found or missing receiver_id');
            res.status(404).json({ error: 'receiver not found or missing receiver_id' });
            return;
        }

        // Insert data into the blood_delivery table
        const insertBloodDeliveryQuery = `
            INSERT INTO blood_delivery (delivery_date, donor_id, receiver_id, blood_type, blood_bank_id)
            VALUES (?, ?, ?, ?, ?)
        `;

        // Fetch the blood_bank_id based on the blood_bank_name
        const bloodBankIdQuery = `
            SELECT blood_bank_id FROM blood_bank WHERE blood_bank_name = ?
        `;

        pool.query(bloodBankIdQuery, [blood_bank_name], (error, bloodBankResults) => {
            if (error) {
                console.error('Error fetching blood_bank_id:', error);
                res.status(500).json({ error: 'Internal Server Error' });
                return;
            }

            const blood_bank_id = bloodBankResults.length > 0 ? bloodBankResults[0].blood_bank_id : null;

            if (!blood_bank_id) {
                console.error('Blood bank not found or missing blood_bank_id');
                res.status(404).json({ error: 'Blood bank not found or missing blood_bank_id' });
                return;
            }

            // Execute the blood delivery insertion query with blood_type and blood_bank_id
            pool.query(insertBloodDeliveryQuery, [currentDate, donor_id, receiver_id, blood_type, blood_bank_id], (error, results) => {
                if (error) {
                    console.error('Error inserting data into blood_delivery table:', error);
                    res.status(500).json({ error: 'Internal Server Error' });
                    return;
                } else {
                    console.log('Data inserted into blood_delivery table successfully.');
                    // Proceed with rendering the generateBill.html file with the provided data

                    // Render the generateBill.html file with the provided data
                    const generateBillTemplatePath = path.join(__dirname, '/public/Front-end/generateBill.html');
                    const generateBillTemplate = fs.readFileSync(generateBillTemplatePath, 'utf-8');

                    const generateBillHtml = generateBillTemplate
                        .replace('{{receiver_name}}', receiver_name)
                        .replace('{{r_phno}}', r_phno)
                        .replace('{{hospital_address}}', hospital_address)
                        .replace('{{r_address}}', r_address)
                        .replace('{{donor_id}}', donor_id)
                        .replace('{{donor_name}}', donor_name)
                        .replace('{{phone_no}}', phone_no)
                        .replace('{{donor_address}}', donor_address)
                        .replace('{{blood_type}}', blood_type)
                        .replace('{{blood_bank_name}}', blood_bank_name);

                    // Send the generated HTML as the response
                    res.send(generateBillHtml);
                }
            });
        });
    });
});



// Route to get the number of blood deliveries for a given month
app.get('/bloodDeliveriesByMonth/:year/:month', (req, res) => {
    const { year, month } = req.params;

    // Construct the query to count the number of blood deliveries for the given month
    const countBloodDeliveriesQuery = `
        SELECT COUNT(*) AS delivery_count
        FROM blood_delivery
        WHERE YEAR(delivery_date) = ? AND MONTH(delivery_date) = ?
    `;

    // Execute the query
    pool.query(countBloodDeliveriesQuery, [year, month], (error, results) => {
        if (error) {
            console.error('Error counting blood deliveries:', error);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }

        const deliveryCount = results[0].delivery_count;
        res.json({ year, month, deliveryCount });
    });
});

// Route to get the number of blood deliveries for a given year
app.get('/bloodDeliveriesByYear/:year', (req, res) => {
    const { year } = req.params;

    // Construct the query to count the number of blood deliveries for the given year
    const countBloodDeliveriesQuery = `
        SELECT COUNT(*) AS delivery_count
        FROM blood_delivery
        WHERE YEAR(delivery_date) = ?
    `;

    // Execute the query
    pool.query(countBloodDeliveriesQuery, [year], (error, results) => {
        if (error) {
            console.error('Error counting blood deliveries:', error);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }

        const deliveryCount = results[0].delivery_count;
        res.json({ year, deliveryCount });
    });
});

app.get('/bloodDeliveriesByType/:bloodType', (req, res) => {
    
    const { bloodType } = req.params;
    

    // Construct the query to count the number of blood deliveries for the given blood type
    const countBloodDeliveriesQuery = `
        SELECT COUNT(*) AS delivery_count
        FROM blood_delivery
        WHERE blood_type = ?
    `;

    // Execute the query
    pool.query(countBloodDeliveriesQuery, [bloodType], (error, results) => {
        if (error) {
            console.error('Error counting blood deliveries:', error);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }

        const deliveryCount = results[0].delivery_count;
        res.json({ bloodType, deliveryCount });
    });
});
app.get('/bloodDeliveriesByBloodBank/:bloodBankId', (req, res) => {
    const { bloodBankId } = req.params;

    // Construct the query to count the number of blood deliveries for the given blood bank
    const countBloodDeliveriesQuery = `
        SELECT COUNT(*) AS delivery_count
        FROM blood_delivery
        WHERE blood_bank_id = ?
    `;

    // Execute the query
    pool.query(countBloodDeliveriesQuery, [bloodBankId], (error, results) => {
        if (error) {
            console.error('Error counting blood deliveries:', error);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }

        const deliveryCount = results[0].delivery_count;
        res.json({ bloodBankId, deliveryCount });
    });
});


app.post('/deleteDoctor', (req, res) => {
    const { doctor_id_to_delete } = req.body;
    console.log(doctor_id_to_delete);
    const deleteDoctorQuery = `
      DELETE FROM doctor
      WHERE id = ${doctor_id_to_delete}
    `;

    executeQuery(deleteDoctorQuery, null);
    res.redirect("/admin")
});

// Delete Blood Bank
app.post('/deleteBloodBank', (req, res) => {
    const { blood_bank_id_to_delete } = req.body;
    console.log(blood_bank_id_to_delete);

    const deleteBloodBankQuery = `
      DELETE FROM blood_bank
      WHERE blood_bank_id = ${blood_bank_id_to_delete}
    `;

    executeQuery(deleteBloodBankQuery, null);
    res.redirect("/admin")
});


// Add these routes after the existing routes

// Get Doctors
app.get('/getDoctors', (req, res) => {
    const query = 'SELECT id, doctor_name FROM doctor';

    pool.query(query, (error, results) => {
        if (error) {
            console.error('Error fetching doctors:', error);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }

        res.json(results);
    });
});

// Get Blood Banks
app.get('/getBloodBank', (req, res) => {
    const query = 'SELECT blood_bank_id, blood_bank_name FROM blood_bank';

    pool.query(query, (error, results) => {
        if (error) {
            console.error('Error fetching blood banks:', error);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }

        res.json(results);
    });
});




app.listen(port, () => {

    console.log(`Server is running on http://localhost:${process.env.PORT || port}`);
});
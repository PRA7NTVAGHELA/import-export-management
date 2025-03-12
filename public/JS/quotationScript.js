document.getElementById("toggleFormBtn").addEventListener("click", function() {
    document.getElementById("quotationFormContainer").classList.add("show");
});

document.getElementById("closeFormBtn").addEventListener("click", function() {
    document.getElementById("quotationFormContainer").classList.remove("show");
});

//

document.addEventListener("DOMContentLoaded", function () {
    let activeDropdown = null;

    document.querySelectorAll(".action-btn").forEach(button => {
        button.addEventListener("click", async function (event) {
            event.stopPropagation();

            // Remove any previously opened dropdown
            if (activeDropdown) {
                activeDropdown.remove();
            }

            // Get Quotation ID from closest row
            const row = button.closest("tr");
            const quotationId = row ? row.getAttribute("data-id") : null;

            if (!quotationId) {
                console.error("Error: Quotation ID not found.");
                return;
            }

            // **Fetch the signed Excel URL from the backend**
            let excelUrl = "";
            try {
                const response = await fetch(`/get-excel-url/${quotationId}`);
                const data = await response.json();
                if (data.excelUrl) {
                    excelUrl = data.excelUrl;
                } else {
                    console.error("Excel URL not found");
                }
            } catch (error) {
                console.error("Error fetching Excel URL:", error);
            }

            // **Create new dropdown dynamically**
            let dropdown = document.createElement("div");
            dropdown.classList.add("floating-dropdown");
            dropdown.innerHTML = `
                <a href="#" class="view" data-id="${quotationId}">👁️ View</a>
               <a href="#" class="updateQuotationBtn" data-id="${quotationId}">✏️ Update</a>
                <a href="#" onclick="deleteQuotation('${quotationId}')">🗑️ Delete</a>
                <a href="#" class="excel" data-id="${quotationId}" data-url="${excelUrl}">📊 Excel</a> <!-- Updated Excel Button -->
                <a href="#" class="sendMail" data-id="${quotationId}" onclick="handleSendMailClick('${quotationId}'); return false;">📧 Send Mail</a>
            `;

            document.body.appendChild(dropdown);
            activeDropdown = dropdown;

            // Get button position
            let rect = button.getBoundingClientRect();
            dropdown.style.position = "absolute";
            dropdown.style.left = `${rect.left}px`;
            dropdown.style.top = `${rect.bottom + window.scrollY}px`;

            // **Handle Excel Button Click (Force Open in New Tab)**
            dropdown.querySelector(".excel").addEventListener("click", function (e) {
                e.preventDefault();
                const fileUrl = this.getAttribute("data-url");
                if (fileUrl) {
                    window.open(fileUrl, "_blank"); // Open in a new tab
                } else {
                    alert("Excel file not found.");
                }
            });

            // Close dropdown when clicking outside
            document.addEventListener("click", function closeDropdown(e) {
                if (!dropdown.contains(e.target) && e.target !== button) {
                    dropdown.remove();
                    activeDropdown = null;
                    document.removeEventListener("click", closeDropdown);
                }
            });
        });
    });
});




document.addEventListener("click", (e) => {
    // Handle "View" button
    if (e.target.classList.contains("view")) {
        e.preventDefault();
        const quotationId = e.target.getAttribute("data-id");

        if (quotationId) {
            window.location.href = `/quotation/view/${quotationId}`;
        } else {
            alert("Error: Quotation ID not found.");
        }
    }

});





async function deleteQuotation(quotationId) {
    if (confirm('Are you sure you want to delete this quotation?')) {
        try {
            const response = await fetch(`http://localhost:3000/quotations//${quotationId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const result = await response.json();
            if (response.ok) {
                alert(result.message); // "Quotation and associated files deleted successfully"
                // Remove the row from the table
                document.querySelector(`tr[data-id='${quotationId}']`).remove();
                // Remove dropdown
                const dropdown = document.querySelector('.floating-dropdown');
                if (dropdown) dropdown.remove();
            } else {
                console.error('Server response:', result);
                alert(result.message || 'Failed to delete quotation');
            }
        } catch (error) {
            console.error('Fetch error:', error.message, error.stack);
            alert('An error occurred while deleting the quotation: ' + error.message);
        }
    }
}


document.addEventListener("DOMContentLoaded", function () {
    // Get all update buttons
    const updateButtons = document.querySelectorAll(".updateQuotationBtn");

    updateButtons.forEach(button => {
        button.addEventListener("click", async function (e) {
            e.preventDefault(); // Prevent default link behavior
            const quotationId = this.dataset.id;

            try {
                // Fetch existing quotation data
                const response = await fetch(`/quotations/get/${quotationId}`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch quotation');
                }

                const quotation = await response.json();

                // Show and populate the form
                const formContainer = document.getElementById("quotationFormContainer");
                formContainer.style.display = "block";

                // Populate form fields (with fallback empty strings)
                document.querySelector("input[name='date']").value = quotation.date || '';
                document.querySelector("select[name='consignee_id']").value = quotation.consignee_id || '';
                document.querySelector("textarea[name='consignee_address']").value = quotation.consignee_address || '';
                document.querySelector("select[name='country_id']").value = quotation.country_id || '';
                document.querySelector("select[name='port_id']").value = quotation.port_id || '';
                document.querySelector("select[name='currency_id']").value = quotation.currency_id || '';
                document.querySelector("input[name='conversion_rate']").value = quotation.conversion_rate || '';
                document.querySelector("input[name='totalNetWeight']").value = quotation.totalNetWeight || '';
                document.querySelector("input[name='totalGrossWeight']").value = quotation.totalGrossWeight || '';
                document.querySelector("input[name='total_native']").value = quotation.total_native || '';
                document.querySelector("input[name='total_inr']").value = quotation.total_inr || '';

                // Store the quotation ID in a hidden field or data attribute
                document.getElementById("quotationForm").dataset.quotationId = quotationId;

            } catch (error) {
                console.error("Error fetching quotation:", error);
                alert("Failed to load quotation details. Please try again.");
            }
        });
    });

    // Handle form submission
    const quotationForm = document.getElementById("quotationForm");
    if (quotationForm) {
        quotationForm.addEventListener("submit", async function (e) {
            e.preventDefault();

            const quotationId = this.dataset.quotationId;
            const formData = new FormData(this);
            const data = Object.fromEntries(formData.entries());

            try {
                const response = await fetch(`/quotations/update/${quotationId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(data)
                });

                const result = await response.json();

                if (response.ok) {
                    alert("Quotation updated successfully!");
                    document.getElementById("quotationFormContainer").style.display = "none";
                    // Optionally refresh the page or update the UI
                    // location.reload();
                } else {
                    throw new Error(result.message || "Failed to update quotation");
                }
            } catch (error) {
                console.error("Error updating quotation:", error);
                alert(`Error updating quotation: ${error.message}`);
            }
        });
    }
});

dropdown.querySelector(".sendMail").addEventListener("click", function (e) {
    e.preventDefault();
    const quotationId = this.getAttribute("data-id");
    openMailForm(quotationId);
    dropdown.remove();
});


// Function to handle Send Mail click
function handleSendMailClick(quotationId) {
    console.log("Send Mail clicked for Quotation ID:", quotationId); // Debugging
    try {
        // Close the dropdown
        const dropdown = document.querySelector(".floating-dropdown");
        if (dropdown) {
            dropdown.remove();
            console.log("Dropdown removed"); // Debugging
        }

        // Open the mail form
        openMailForm(quotationId);
    } catch (error) {
        console.error("Error in handleSendMailClick:", error);
        alert("An error occurred while opening the mail form. Please check the console for details.");
    }
}

// Function to open the mail form on the left side
function openMailForm(quotationId) {
    console.log("Opening mail form for Quotation ID:", quotationId); // Debugging

    // Remove any existing mail form
    const existingForm = document.querySelector(".mail-form-container");
    if (existingForm) {
        console.log("Removing existing mail form"); // Debugging
        existingForm.remove();
    }

    // Create the mail form container
    const mailFormContainer = document.createElement("div");
    mailFormContainer.classList.add("mail-form-container");

    // Ensure the form is visible with proper styling
    mailFormContainer.style.cssText = `
        position: fixed;
        left: 0;
        top: 0;
        width: 400px;
        height: 100vh;
        background-color: #ffffff;
        box-shadow: 2px 0 5px rgba(0, 0, 0, 0.2);
        padding: 20px;
        z-index: 10000;
        overflow-y: auto;
        display: block;
    `;

    // Add the form HTML
    mailFormContainer.innerHTML = `
        <h3>Send Email</h3>
        <form id="sendMailForm">
            <div style="margin-bottom: 15px;">
                <label for="subject">Subject *</label>
                <input type="text" id="subject" name="subject" value="Proforma Invoice Attached for Your Review" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" required>
            </div>
            <div style="margin-bottom: 15px;">
                <label for="receiverEmail">Receiver Email ID *</label>
                <input type="email" id="receiverEmail" name="receiverEmail" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" required>
            </div>
            <div style="margin-bottom: 15px;">
                <label for="ccEmail">CC Email</label>
                <input type="email" id="ccEmail" name="ccEmail" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 15px;">
                <label for="content">Content</label>
                <textarea id="content" name="content" style="width: 100%; height: 150px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; resize: vertical;" required>Dear Sir,

We are attaching the Proforma Invoice No PI/23/24B-25 dtd 06/03/2025 for TCM CHLOROFORM (10,000 LT) CIF NAURU.

Please arrange to send SIGNED Proforma Invoice.

Thanks & Regards,
Test Server</textarea>
            </div>
            <div style="margin-bottom: 15px;">
                <label for="attachment">Attachment</label>
                <div id="attachmentArea">Fetching PDF...</div>
            </div>
            <div style="text-align: right;">
                <button type="button" onclick="closeMailForm()" style="padding: 8px 16px; background-color: #ff4d4d; color: white; border: none; border-radius: 4px; margin-right: 10px; cursor: pointer;">Close</button>
                <button type="submit" style="padding: 8px 16px; background-color: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">Send Email</button>
            </div>
        </form>
    `;

    // Append the form to the body
    document.body.appendChild(mailFormContainer);
    console.log("Mail form appended to body"); // Debugging

    // Ensure the form is visible
    mailFormContainer.scrollIntoView({ behavior: "smooth", block: "start" });

    // Fetch the PDF from S3
    fetchPDFFromS3(quotationId);

    // Handle form submission
    const form = mailFormContainer.querySelector("#sendMailForm");
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        console.log("Form submitted for Quotation ID:", quotationId); // Debugging
        await sendEmail(form, quotationId);
    });
}

// Function to close the mail form
function closeMailForm() {
    const mailFormContainer = document.querySelector(".mail-form-container");
    if (mailFormContainer) {
        console.log("Closing mail form"); // Debugging
        mailFormContainer.remove();
    }
}

// Function to fetch PDF from S3
// Function to fetch PDF from S3
async function fetchPDFFromS3(quotationId) {
    try {
        console.log("Fetching PDF for Quotation ID:", quotationId); // Debugging
        const response = await fetch(`/api/getS3Url?quotationId=${quotationId}`);
        console.log("API Response Status:", response.status); // Debugging
        const data = await response.json();
        console.log("API Response Data:", data); // Debugging

        if (data.success && data.url) {
            const attachmentArea = document.querySelector("#attachmentArea");
            attachmentArea.innerHTML = `<a href="${data.url}" target="_blank">Quotation_${quotationId}.pdf</a>`;
            attachmentArea.setAttribute("data-file-url", data.url);
            console.log("PDF fetched successfully:", data.url); // Debugging
        } else {
            throw new Error("PDF not found or API returned failure");
        }
    } catch (error) {
        const attachmentArea = document.querySelector("#attachmentArea");
        if (attachmentArea) {
            attachmentArea.innerHTML = `Failed to fetch PDF. Error: ${error.message}`;
        }
        console.error("Error fetching PDF:", error);
    }
}

// Function to send the email
// Function to send the email
async function sendEmail(form, quotationId) {
    const formData = new FormData(form);
    const attachmentUrl = document.querySelector("#attachmentArea").getAttribute("data-file-url");

    const emailData = {
        subject: formData.get("subject"),
        receiverEmail: formData.get("receiverEmail"),
        ccEmail: formData.get("ccEmail"),
        content: formData.get("content"),
        attachment: attachmentUrl,
        quotationId: quotationId,
    };

    try {
        console.log("Sending email with data:", emailData); // Debugging
        const response = await fetch("/api/sendEmail", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(emailData),
        });
        console.log("API Response Status:", response.status); // Debugging
        const result = await response.json();
        console.log("API Response Data:", result); // Debugging
        if (result.success) {
            alert("Email sent successfully!");
            closeMailForm();
        } else {
            throw new Error(result.message || "Failed to send email");
        }
    } catch (error) {
        alert("Error sending email: " + error.message);
        console.error("Error sending email:", error);
    }
}
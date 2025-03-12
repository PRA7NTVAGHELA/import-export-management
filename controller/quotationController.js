import sequelize from '../Config/db.js';
import consigneeSchema from '../model/consigneeSchema.js';
import countrySchema from '../model/countrySchema.js';
import currencySchema from '../model/currencySchema.js';
import PackageSchema from '../model/packageSchema.js';
import portSchema from '../model/portSchema.js';
import productSchema from '../model/productSchema.js';
import unitSchema from '../model/unitSchema.js';
import quotationSchema from '../model/quotationSchema.js';
import quotationProductSchema from '../model/quotationProductSchema.js';
import ExcelJS from "exceljs";
import { join } from 'path';
import nodemailer from 'nodemailer';
import multer from 'multer';


import { readFile } from 'fs/promises';
import path from 'path';
import AWS from "aws-sdk";
import dotenv from 'dotenv';
 dotenv.config();
const __dirname = path.resolve();
import puppeteer from 'puppeteer';
import ejs from 'ejs'
import pkg from 'number-to-words';
const {toWords} = pkg




const splitProductId = (productIdString) => {
    if (typeof productIdString === "string" && productIdString.includes("-")) {
        const [product_id, variant_id] = productIdString.split("-").map(num => parseInt(num, 10));
        return { product_id, variant_id };
    }
    return { product_id: parseInt(productIdString, 10), variant_id: null };
};


// Configure multer for file uploads
const storage = multer.memoryStorage(); // Store files in memory for now
const upload = multer({ storage: storage });

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});


export const getform = async (req, res) => {
    try {
        const consignees = await consigneeSchema.findAll();
        const ports = await portSchema.findAll();
        const countries = await countrySchema.findAll();
        const currencies = await currencySchema.findAll();
        const products = await productSchema.findAll();
        const units = await unitSchema.findAll();
        const packages = await PackageSchema.findAll();

        let quotations = await quotationSchema.findAll({
            include: [
                {
                    model: quotationProductSchema,
                    include: [
                        { model: productSchema, attributes: ['productName', 'variants'] },
                        { model: unitSchema, attributes: ['orderUnit', 'packingUnit'] },
                    ],
                },
                { model: consigneeSchema, attributes: ['name', 'address'] },
                { model: countrySchema, attributes: ['country_name'] },
                { model: portSchema, attributes: ['portName'] },
                { model: currencySchema, attributes: ['currency'] },
            ],
        });

        res.render('quotation', {
            consignees,
            ports,
            countries,
            currencies,
            products,
            units,
            packages,
            quotations
        });
    } catch (error) {
        console.error("Error fetching data for quotation form:", error);
        res.status(500).send("Internal Server Error");
    }
};

export const getQuotation = async (req, res) => {
    try {
        const { id } = req.params;
        const quotation = await quotationSchema.findOne({
            where: { id },
            include: [
                {
                    model: quotationProductSchema,
                    include: [
                        { model: productSchema, attributes: ['id', 'productName', 'variants'] },
                        { model: unitSchema, attributes: ['id', 'orderUnit', 'packingUnit'] },
                        { model: PackageSchema, attributes: ['id', 'netWeight', 'grossWeight'] },
                    ],
                },
                { model: consigneeSchema, attributes: ['id', 'name', 'address'] },
                { model: countrySchema, attributes: ['id', 'country_name'] },
                { model: portSchema, attributes: ['id', 'portName'] },
                { model: currencySchema, attributes: ['id', 'currency'] },
            ]
        });

        if (!quotation) {
            return res.status(404).json({ message: "Quotation not found" });
        }

        return res.status(200).json(quotation);
    } catch (error) {
        console.error('Error fetching quotation:', error.message, error.stack);
        return res.status(500).json({ message: "Error fetching quotation", error: error.message });
    }
};

export const quotationCreate = async(req,res) => {
    try {
        let {
            date,
            consignee_id,
            country_id,
            port_id,
            currency_id,
            conversion_rate,
            totalNetWeight,
            totalGrossWeight,
            total_native,
            total_inr,
            products,
            product_id,
            quantity,
            price,
            total,
            unit_id,
            netWeight,
            grossWeight,
            totalPackage,
            package_id
        } = req.body;

        console.log('full body log :',req.body)

        if (!products || !Array.isArray(products)) {

            if (!Array.isArray(product_id)) {
                product_id = [product_id];
                quantity = [quantity];
                price = [price];
                total = [total];
                unit_id = [unit_id];
                netWeight = [netWeight];
                grossWeight = [grossWeight];
                totalPackage = [totalPackage];
                package_id = [package_id];
            }

            products = product_id.map((id, index) => ({
                product_id: id,
                quantity: quantity[index],
                price: price[index],
                total: total[index],
                unit_id: unit_id[index],
                netWeight: netWeight[index],
                grossWeight: grossWeight[index],
                totalPackage: totalPackage[index],
                package_id: package_id[index]
            }));
        }

        console.log("Processed Products Array:", products);

        const newQuotation = await quotationSchema.create({
            date,
            consignee_id,
            country_id,
            port_id,
            currency_id,
            conversion_rate,
            totalNetWeight,
            totalGrossWeight,
            total_native,
            total_inr
        });

        console.log("New Quotation:", newQuotation);

        // console.log('new quotation : ',newQuotation)
        if (products && Array.isArray(products) && products.length > 0) {
            const quotationProducts = products.map(product => {
                let { product_id, variant_id } = splitProductId(product.product_id); 

                product_id = parseInt(product_id, 10);
                variant_id = variant_id ? parseInt(variant_id, 10) : null;

                
                if (isNaN(product_id)) {
                    console.error(`Invalid product_id at index ${index}:`, product.product_id);
                    return null; // Skip this entry
                }

                return {
                    quotation_id: newQuotation.id,
                    product_id,
                    variant_id, 
                    quantity: parseFloat(product.quantity),
                    price: parseFloat(product.price),
                    total : parseFloat(product.total),
                    totalSingleProduct: parseFloat(product.total),
                    unit_id: parseInt(product.unit_id, 10),
                    net_weight: parseFloat(product.netWeight),
                    gross_weight: parseFloat(product.grossWeight),
                    total_package: parseInt(product.totalPackage, 10),
                    package_id: parseInt(product.package_id, 10)
                };
            });

            console.log('quotation products :',quotationProducts)

            await quotationProductSchema.bulkCreate(quotationProducts);
        }

        res.status(201).json({ message: "Quotation created successfully", quotation: newQuotation });
    } catch (error) {
        console.error("Error creating quotation:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}


export const getPDF = async(req,res) => {
        const {id} = req.params
    try {
        let quotations = await quotationSchema.findOne({
            where : {id},
            include: [
                {
                    model: quotationProductSchema,
                    include: [
                        { model: productSchema, attributes: ['productName','variants'] },
                        { model: unitSchema, attributes: ['orderUnit','packingUnit'] },
                    ],
                   
                },
                { model: consigneeSchema, attributes: ['name','address'] }, // Fetch consignee name
                { model: countrySchema, attributes: ['country_name'] }, // Fetch country name
                { model: portSchema, attributes: ['portName'] }, // Fetch port name
                { model: currencySchema, attributes: ['currency'] },
            ],
        });
        const quotationData = quotations.toJSON();

        // ✅ Calculate total quantity
        quotationData.totalQuantity = quotationData.QuotationProducts.reduce((sum, product) => {
            return sum + parseFloat(product.quantity);
        }, 0);

        // ✅ Keep the original number and also store words
        quotationData.total_native_words = toWords(Number(quotationData.total_native)) + " " + quotationData.Currency.currency + " ONLY"; // In words
        res.render('pdf',{quotations : quotationData})
    } catch (error) {
        console.error('Error fetching quotations:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
    
}



const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

// generate pdf exel


export const generatePDFAndExcel = async (req, res) => {
    try {
        const { id } = req.params;

        // Fetch quotation details from the database
        let quotations = await quotationSchema.findOne({
            where: { id },
            include: [
                {
                    model: quotationProductSchema,
                    include: [
                        { model: productSchema, attributes: ['productName', 'variants'] },
                        { model: unitSchema, attributes: ['orderUnit', 'packingUnit'] },
                    ],
                },
                { model: consigneeSchema, attributes: ['name', 'address'] },
                { model: countrySchema, attributes: ['country_name'] },
                { model: currencySchema, attributes: ['currency'] },
            ],
        });

        if (!quotations) return res.status(404).json({ message: 'Quotation not found' });

        const quotationData = quotations.toJSON();
        quotationData.totalQuantity = quotationData.QuotationProducts.reduce((sum, product) => sum + parseFloat(product.quantity || 0), 0);
        quotationData.totalNetWeight = quotationData.QuotationProducts.reduce((sum, product) => sum + parseFloat(product.net_weight || 0), 0);
        quotationData.totalGrossWeight = quotationData.QuotationProducts.reduce((sum, product) => sum + parseFloat(product.gross_weight || 0), 0);
        quotationData.total_native_words = toWords(Number(quotationData.total_native)) + ' ' + (quotationData.Currency?.currency || 'SGD') + ' ONLY';

        // Define the logo path (adjust based on your project structure)
        const logoPath = join(__dirname, 'public', 'images', 'logo.ong.jpg'); // Example path
        const logoUrl = `file://${logoPath}`; // Convert to file URL for Puppeteer

        /*** Generate PDF ***/
        let pdfBuffer;
        try {
            // Use readFile from fs/promises
            const ejsTemplatePath = join(__dirname, 'views/pdf.ejs');
             

            const ejsTemplate = await readFile(ejsTemplatePath, { encoding: 'utf-8' });
            

            const htmlContent = ejs.render(ejsTemplate, { quotations: quotationData, logoPath: logoUrl });
            

            const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
            const page = await browser.newPage();
            await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

            pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
            await browser.close();
        } catch (pdfError) {
            console.error('Error details in PDF generation:', pdfError);
            return res.status(500).json({ message: 'Error generating PDF', error: pdfError });
        }

        /*** Generate Excel ***/
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Quotation');

        // Load logo for Excel
        const logoBuffer = await readFile(logoPath); 
        const logoId = workbook.addImage({
            buffer: logoBuffer,
            extension: 'png',
        });

       
        worksheet.addImage(logoId, {
            tl: { col: 0, row: 0 },
            ext: { width: 100, height: 50 }, 
            editAs: 'absolute', 
        });

        // Define styles (unchanged)
        const borderStyle = {
            top: { style: 'thin', color: { argb: 'D3D3D3' } },
            left: { style: 'thin', color: { argb: 'D3D3D3' } },
            bottom: { style: 'thin', color: { argb: 'D3D3D3' } },
            right: { style: 'thin', color: { argb: 'D3D3D3' } }
        };

        const titleStyle = {
            font: { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFF' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '1F4E78' } },
            alignment: { vertical: 'middle', horizontal: 'center' },
            border: borderStyle
        };

        const headerStyle = {
            font: { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFF' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '2E75B6' } },
            alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
            border: {
                top: { style: 'medium', color: { argb: 'D3D3D3' } },
                left: { style: 'thin', color: { argb: 'D3D3D3' } },
                bottom: { style: 'medium', color: { argb: 'D3D3D3' } },
                right: { style: 'thin', color: { argb: 'D3D3D3' } }
            }
        };

        const dataStyle = {
            font: { name: 'Calibri', size: 10, color: { argb: '333333' } },
            alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
            border: borderStyle,
            numFmt: '#,##0.00'
        };

        const textDataStyle = {
            font: { name: 'Calibri', size: 10, color: { argb: '333333' } },
            alignment: { vertical: 'middle', horizontal: 'left', wrapText: true },
            border: borderStyle
        };

        const totalStyle = {
            font: { name: 'Calibri', size: 10, bold: true, color: { argb: '003087' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E6F0FA' } },
            alignment: { vertical: 'middle', horizontal: 'center' },
            border: {
                top: { style: 'medium', color: { argb: 'D3D3D3' } },
                left: { style: 'thin', color: { argb: 'D3D3D3' } },
                bottom: { style: 'thin', color: { argb: 'D3D3D3' } },
                right: { style: 'thin', color: { argb: 'D3D3D3' } }
            }
        };

        const labelStyle = {
            font: { name: 'Calibri', size: 10, bold: true, color: { argb: '1F4E78' } },
            alignment: { vertical: 'middle', horizontal: 'left' },
            border: borderStyle
        };

        const valueStyle = {
            font: { name: 'Calibri', size: 10, color: { argb: '333333' } },
            alignment: { vertical: 'middle', horizontal: 'left', wrapText: true },
            border: borderStyle
        };

        const sectionHeaderStyle = {
            font: { name: 'Calibri', size: 12, bold: true, color: { argb: '1F4E78' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F5F5F5' } },
            alignment: { vertical: 'middle', horizontal: 'center' },
            border: borderStyle
        };

        const footerLabelStyle = {
            font: { name: 'Calibri', size: 10, bold: true, color: { argb: '1F4E78' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F5F5F5' } },
            alignment: { vertical: 'middle', horizontal: 'left' },
            border: borderStyle
        };

        // Adjust the starting row to account for the logo
        worksheet.getRow(1).height = 60; // Increase row height for logo

        // Add title (shifted down to avoid overlapping with logo)
        worksheet.mergeCells('A3:J3');
        const titleCell = worksheet.getCell('A3');
        titleCell.value = 'QUOTATION';
        titleCell.font = { name: 'Arial', size: 14, bold: true };
        titleCell.alignment = { horizontal: 'center' };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4F81BD' } };
        titleCell.border = borderStyle;

        // Header Section
        const headerDataLeft = [
            ['EXPORTER:', quotationData.EXPORTER || 'TEST SERVER'],
            ['ADDRESS:', quotationData.ADDRESS || '405, VARDHMAN TRADE CENTER, RACECOURSE ROAD, RAJKOT, GUJARAT 360001'],
            ['CONSIGNEE:', quotationData.Consignee?.name || ''],
            ['ADDRESS:', quotationData.Consignee?.address || '']
        ];
        const headerDataRight = [
            ['QUOTATION NO:', quotationData.id],
            ['DATE:', quotationData.date],
            ['GSTIN:', quotationData.GSTIN || '12ABCDE1234FZ5'],
            ['FSSAI NO.:', quotationData.FSSAI || '414126'],
            ['COUNTRY OF ORIGIN:', quotationData.Country?.country_name || 'INDIA'],
            ['COUNTRY OF FINAL DESTINATION:', quotationData.Country?.destination || 'CHINA']
        ];

        let currentRow = 5; // Start after title and spacer (adjusted for logo)
        headerDataLeft.forEach(([label, value]) => {
            const row = worksheet.getRow(currentRow);
            row.getCell(1).value = label;
            row.getCell(1).style = labelStyle;
            row.getCell(2).value = value;
            row.getCell(2).style = valueStyle;
            currentRow++;
        });

        currentRow = 5; // Align right headers with left
        headerDataRight.forEach(([label, value]) => {
            const row = worksheet.getRow(currentRow);
            row.getCell(8).value = label; // Column H
            row.getCell(8).style = labelStyle;
            row.getCell(9).value = value; // Column I
            row.getCell(9).style = valueStyle;
            currentRow++;
        });

        worksheet.addRow([]).height = 10; // Spacer row

        // Product Table Label
        const productLabelRow = worksheet.addRow(['Product Details']);
        productLabelRow.getCell(1).font = { name: 'Arial', size: 12, bold: true };
        productLabelRow.getCell(1).alignment = { horizontal: 'left' };

        // Product Table Header
        const productHeader = [
            'SR. NO.', 'MARKING', 'NO. OF PACKAGES', 'DESCRIPTION OF GOODS', 'H.S. CODE',
            'QTY. TOTAL', 'NET W.T.', 'GROSS W.T.', `RATE (${quotationData.Currency?.currency || 'SGD'})`, `TOTAL (${quotationData.Currency?.currency || 'SGD'})`
        ].join(',').split(',').map(item => item.trim());
        const headerRow = worksheet.addRow(productHeader);
        headerRow.eachCell(cell => {
            cell.style = headerStyle;
        });

        // Product Data
        quotationData.QuotationProducts.forEach((product, index) => {
            const row = worksheet.addRow([
                index + 1,
                product.Product?.productName || '',
                product.total_package || '',
                product.description || '',
                product.hs_code || '',
                `${product.quantity || 0} ${product.Unit?.orderUnit || ''}`,
                `${product.net_weight || 0} ${product.Unit?.packingUnit || ''}`,
                `${product.gross_weight || 0} ${product.Unit?.packingUnit || ''}`,
                product.price || 0,
                product.total || 0
            ]);
            row.eachCell((cell, colNumber) => {
                if (colNumber === 2 || colNumber === 4) { // MARKING and DESCRIPTION OF GOODS
                    cell.style = textDataStyle;
                } else {
                    cell.style = dataStyle;
                }
                if (colNumber === 9 || colNumber === 10) { // RATE and TOTAL
                    cell.numFmt = '#,##0.00';
                }
            });
        });

        // Totals Row
        const totalsRow = worksheet.addRow([
            '', '', '', '', 'Total',
            quotationData.totalQuantity,
            quotationData.totalNetWeight,
            quotationData.totalGrossWeight,
            'Subtotal',
            quotationData.total_native
        ]);
        totalsRow.eachCell(cell => {
            cell.style = totalStyle;
        });

        // Set column widths
        worksheet.columns = [
            { key: 'A', width: 10 }, // SR. NO.
            { key: 'B', width: 20 }, // MARKING
            { key: 'C', width: 15 }, // NO. OF PACKAGES
            { key: 'D', width: 25 }, // DESCRIPTION OF GOODS
            { key: 'E', width: 10 }, // H.S. CODE
            { key: 'F', width: 15 }, // QTY. TOTAL
            { key: 'G', width: 15 }, // NET W.T.
            { key: 'H', width: 15 }, // GROSS W.T.
            { key: 'I', width: 12 }, // RATE
            { key: 'J', width: 12 }  // TOTAL
        ];

        // Footer Section
        worksheet.addRow([]).height = 10; // Spacer row
        const footerLabelRow = worksheet.addRow(['Packing & Payment Details']);
        footerLabelRow.getCell(1).font = { name: 'Arial', size: 12, bold: true };
        footerLabelRow.getCell(1).alignment = { horizontal: 'center' };
        footerLabelRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E6E6E6' } };
        worksheet.mergeCells(`A${worksheet.rowCount}:J${worksheet.rowCount}`);

        const footerData = [
            ['Total Net Weight:', quotationData.totalNetWeight],
            ['Total Gross Weight:', quotationData.totalGrossWeight],
            ['Amount in Words:', quotationData.total_native_words],
            [],
            ['Declaration:', 'We hereby declare all documents and quality tested.'],
            ['Customer Care:', '9723345023 | vgqa00@gmail.com']
        ];

        footerData.forEach(([label, value]) => {
            const row = worksheet.addRow([]);
            row.getCell(1).value = label;
            row.getCell(1).style = footerLabelStyle;
            row.getCell(2).value = value;
            row.getCell(2).style = valueStyle;
        });

        // Generate Excel buffer
        const excelBuffer = await workbook.xlsx.writeBuffer();

        /*** Upload files to S3 ***/
        const s3 = new AWS.S3();
        const pdfKey = `quotations/invoice_${id}.pdf`;
        const excelKey = `quotations/invoice_${id}.xlsx`;

        await s3.upload({
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: pdfKey,
            Body: pdfBuffer,
            ContentType: 'application/pdf',
            ACL: 'private'
        }).promise();

        await s3.upload({
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: excelKey,
            Body: excelBuffer,
            ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            ACL: 'private'
        }).promise();

        /*** Generate Signed URLs ***/
        const signedPdfUrl = s3.getSignedUrl('getObject', {
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: pdfKey,
            Expires: 3600
        });
        const signedExcelUrl = s3.getSignedUrl('getObject', {
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: excelKey,
            Expires: 3600
        });

        return res.status(200).json({
            message: 'PDF and Excel generated and uploaded successfully',
            pdfUrl: signedPdfUrl,
            excelUrl: signedExcelUrl
        });
    } catch (error) {
        console.error('Error generating or uploading PDF/Excel:', error);
        res.status(500).json({ message: 'Error generating or uploading PDF/Excel', error });
    }
};

// view quotation pdf
export const viewQuotationPDF = async (req, res) => {
    try {
        const { id } = req.params;
        const bucketName = process.env.AWS_S3_BUCKET_NAME;

        if (!bucketName) {
            console.error("AWS_BUCKET_NAME is missing in environment variables.");
            return res.status(500).send("Internal Server Error: Missing AWS_BUCKET_NAME");
        }

        const filePath = `quotations/invoice_${id}.pdf`;

        const signedUrl = s3.getSignedUrl("getObject", {
            Bucket: bucketName,
            Key: filePath,
            Expires: 60 * 60, // 5 minutes expiration
        });

        res.render("partial/viewQuotation", { pdfUrl: signedUrl });
    } catch (error) {
        console.error("Error generating signed URL:", error);
        res.status(500).send("Internal Server Error");
    }
};

// delete quotation pdf from s3
export const deleteQuotation = async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`Attempting to delete quotation with ID: ${id}`);

        const quotation = await quotationSchema.findOne({ where: { id } });
        if (!quotation) {
            console.log(`Quotation not found for ID: ${id}`);
            return res.status(404).json({ message: "Quotation not found" });
        }

        const pdfKey = `quotations/invoice_${id}.pdf`;
        const excelKey = `quotations/invoice_${id}.xlsx`;

        const deleteS3File = async (key) => {
            const s3Params = { Bucket: process.env.AWS_S3_BUCKET_NAME, Key: key };
            try {
                await s3.headObject(s3Params).promise();
                await s3.deleteObject(s3Params).promise();
                console.log(`File deleted from S3: ${key}`);
            } catch (err) {
                console.log(`File not found in S3 or already deleted: ${key}`);
            }
        };

        await Promise.all([deleteS3File(pdfKey), deleteS3File(excelKey)]);
        await quotationSchema.destroy({ where: { id } });

        console.log(`Quotation deleted successfully for ID: ${id}`);
        return res.status(200).json({ message: "Quotation and associated files deleted successfully" });
    } catch (error) {
        console.error("Error deleting quotation and files:", error.message, error.stack);
        return res.status(500).json({ message: "Error deleting quotation", error: error.message });
    }
};

// updating quotation

export const updateQuotation = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            date, consignee_id, consignee_address, country_id, port_id,
            currency_id, conversion_rate, totalNetWeight, totalGrossWeight,
            total_native, total_inr, product_id, quantity, price, total,
            unit_id, netWeight, grossWeight, totalPackage, package_id
        } = req.body;

        const quotation = await quotationSchema.findOne({ where: { id } });
        if (!quotation) {
            return res.status(404).json({ message: "Quotation not found" });
        }

        // Update main quotation fields
        await quotation.update({
            date, consignee_id, consignee_address, country_id, port_id,
            currency_id, conversion_rate, totalNetWeight, totalGrossWeight,
            total_native, total_inr
        });

        // Update or replace products (assuming product data comes as arrays)
        if (product_id) {
            await quotationProductSchema.destroy({ where: { quotationId: id } }); // Clear existing products
            const productIds = Array.isArray(product_id) ? product_id : [product_id];
            const quantities = Array.isArray(quantity) ? quantity : [quantity];
            const prices = Array.isArray(price) ? price : [price];
            const totals = Array.isArray(total) ? total : [total];
            const unitIds = Array.isArray(unit_id) ? unit_id : [unit_id];
            const netWeights = Array.isArray(netWeight) ? netWeight : [netWeight];
            const grossWeights = Array.isArray(grossWeight) ? grossWeight : [grossWeight];
            const totalPackages = Array.isArray(totalPackage) ? totalPackage : [totalPackage];
            const packageIds = Array.isArray(package_id) ? package_id : [package_id];

            for (let i = 0; i < productIds.length; i++) {
                await quotationProductSchema.create({
                    quotationId: id,
                    productId: productIds[i].split('-')[0], // Extract product ID
                    variantId: productIds[i].split('-')[1] || null, // Extract variant ID if present
                    quantity: quantities[i],
                    price: prices[i],
                    total: totals[i],
                    unitId: unitIds[i],
                    net_weight: netWeights[i],
                    gross_weight: grossWeights[i],
                    total_package: totalPackages[i],
                    packageId: packageIds[i]
                });
            }
        }

        return res.status(200).json({ message: "Quotation updated successfully" });
    } catch (error) {
        console.error('Error updating quotation:', error.message, error.stack);
        return res.status(500).json({ message: "Error updating quotation", error: error.message });
    }
};


export const getExcelUrl = async (req, res) => {
    try {
        const { id } = req.params;
        const s3 = new AWS.S3();
        const excelKey = `quotations/invoice_${id}.xlsx`;

        // Generate signed URL for Excel file
        const signedExcelUrl = s3.getSignedUrl('getObject', {
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: excelKey,
            Expires: 3600, // 1-hour expiry
            ResponseContentDisposition: 'attachment; filename="Quotation.xlsx"',
            ResponseContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        res.json({ excelUrl: signedExcelUrl });
    } catch (error) {
        console.error("Error generating Excel URL:", error);
        res.status(500).json({ message: "Error fetching Excel URL" });
    }
};


export const getS3Url = async (req, res) => {
    const { quotationId } = req.query;
    try {
        console.log("Fetching S3 URL for Quotation ID:", quotationId);
        const bucket = process.env.AWS_S3_BUCKET_NAME;
        if (!bucket) {
            throw new Error("S3_BUCKET environment variable is not set");
        }
        const params = {
            Bucket: bucket,
            Key: `quotations/invoice_${quotationId}.pdf`,
            Expires: 3600,
        };
      
        const url = await s3.getSignedUrlPromise("getObject", params);
        
        res.json({ success: true, url });
    } catch (error) {
        console.error("S3 Error:", error);
        res.status(500).json({ success: false, message: "Error fetching S3 URL: " + error.message });
    }
};

// Send email with attachment
export const sendEmail = [
    upload.array("attachments", 10), // Middleware to handle up to 10 files
    async (req, res) => {
        const { subject, receiverEmail, ccEmail, content, quotationId } = req.body;
        

        try {
            const bucket = process.env.AWS_S3_BUCKET_NAME;
            if (!bucket) {
                throw new Error("AWS_S3_BUCKET_NAME environment variable is not set");
            }

            // Retrieve S3 file
            const params = {
                Bucket: bucket,
                Key: `quotations/invoice_${quotationId}.pdf`,
            };
           
            const s3File = await s3.getObject(params).promise();
            

            // Prepare mail options with S3 attachment
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: receiverEmail,
                cc: ccEmail || "",
                subject: subject,
                text: content,
                attachments: [
                    {
                        filename: `Quotation_${quotationId}.pdf`,
                        content: s3File.Body,
                        contentType: "application/pdf",
                    },
                ],
            };

            // Add user-uploaded files to attachments
            if (req.files && req.files.length > 0) {
                req.files.forEach((file) => {
                    mailOptions.attachments.push({
                        filename: file.originalname,
                        content: file.buffer,
                        contentType: file.mimetype,
                    });
                });
                
            }

            console.log("MailOptions:", {
                from: mailOptions.from,
                to: mailOptions.to,
                cc: mailOptions.cc,
                subject: mailOptions.subject,
                text: mailOptions.text,
                attachmentCount: mailOptions.attachments.length,
            });

            const info = await transporter.sendMail(mailOptions);
            console.log("Email sent successfully. Info:", info);
            res.json({ success: true, message: "Email sent successfully" });
        } catch (error) {
            console.error("Email Sending Error:", error);
            res.status(500).json({ success: false, message: "Error sending email: " + error.message });
        }
    },
];
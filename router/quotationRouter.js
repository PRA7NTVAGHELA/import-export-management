import { getform, quotationCreate,getPDF,generatePDFAndExcel, updateQuotation, viewQuotationPDF, getExcelUrl, deleteQuotation, getQuotation, sendEmail,
    getS3Url
  } from '../controller/quotationController.js';
import express from 'express';


const quotationRouter = express.Router();

quotationRouter.get('/quotation',getform)
quotationRouter.post('/quotation/create',quotationCreate)
quotationRouter.get('/quotations/get/:id', getQuotation);
// quotationRouter.get('/quotation/list/:id',listQuotation);
quotationRouter.get('/quotation/pdf/:id',getPDF);
quotationRouter.get('/quotation/generate-pdf/:id',generatePDFAndExcel);
quotationRouter.put('/quotations/update/:id', updateQuotation);

// API to send email
quotationRouter.post("/api/sendEmail", sendEmail);
quotationRouter.get("/api/getS3Url", getS3Url);

    quotationRouter.get('/quotation/view/:id', viewQuotationPDF);
    quotationRouter.get("/get-excel-url/:id", getExcelUrl);
    quotationRouter.delete('/quotations/:id', deleteQuotation);
   
    


//     // API to get S3 URL for PDF
// MailControllerRouter.get("/api/getS3Url", MailController.getS3Url);

// // API to send email
// MailControllerRouter.post("/api/sendEmail", MailController.sendEmail);

export default quotationRouter;
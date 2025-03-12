import express from 'express';
import path from 'path';
import productSchema from './model/productSchema.js';
import './Config/db.js'
import loadRoute from './router/index.js';

const app = express();

const __dirname = path.resolve()  
app.use(express.json())
app.set('view engine','ejs');
app.set('views',path.join(__dirname,'views'));
app.use(express.static(path.join(__dirname,'public')))
app.use(express.urlencoded({ extended: true }));

loadRoute(app)

app.listen(3000,() => {
    console.log('server is a running on a 3000');
})


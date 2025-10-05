const express = require('express')
const app = express()
const cors = require('cors')
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()

// password-0JGiJW5ep5YTH1SM
// username-man_style


// middleware
app.use(cors())








const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rhmlrci.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();


const mansCollection= client.db('manstyle').collection('manproducts')



    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");



// man api

  app.get('/manproducts', async (req, res) => {
  
      const products = mansCollection.find(); 
      const result = await  products.toArray();
      res.send(result);
   
  });


  app.get('/manproducts/:id',async (req, res) =>{
    const id =req.params.id;
    const query ={_id: new ObjectId(id)};
    const product =await mansCollection.findOne(query)
    res.send(product)
  })


  app.get('/manproducts/:id/related', async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const product = await mansCollection.findOne(query);

    if (!product) {
      return res.status(404).send({ error: 'Product not found' });
    }

    // একই category এর product, কিন্তু নিজেকে বাদ দিয়ে
    const related = await mansCollection
      .find({ 
        category: product.category, 
        _id: { $ne: new ObjectId(id) } 
      })
      .limit(4) // চাইলে related limit করতে পারো
      .toArray();

    res.send(related);
  })


  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }



  






}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('man style server')
})

app.listen(port, () => {
  console.log(`man style server listening on port ${port}`)
})
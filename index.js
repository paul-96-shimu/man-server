const express = require('express')
const app = express()
const cors = require('cors')
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()

const stripe = require("stripe")(process.env.PAYMENT_GETWAY_KEY);
// password-0JGiJW5ep5YTH1SM
// username-man_style


// middleware
app.use(cors())

app.use(express.json());






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


    const mansCollection = client.db('manstyle').collection('manproducts')
    const ordersCollection = client.db("manstyle").collection("orders");



    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");



    // man api

    app.get('/manproducts', async (req, res) => {

      const products = mansCollection.find();
      const result = await products.toArray();
      res.send(result);

    });


    app.get('/manproducts/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const product = await mansCollection.findOne(query)
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


    // ✅ POST order

    app.post('/orders', async (req, res) => {
      try {
        const order = req.body;
        const result = await ordersCollection.insertOne(order);
        if (result.insertedId) {
          res.send({ success: true, orderId: result.insertedId });
        } else {
          res.send({ success: false });
        }
      } catch (error) {
        console.error(error);
        res.status(500).send({ success: false, error: error.message });
      }
    });



    // ✅ GET orders by user email
    app.get("/orders/:email", async (req, res) => {
      const email = req.params.email;
      const orders = await ordersCollection.find({ userEmail: email }).toArray();
      res.send(orders);
    });








  // payment api

    // app.post("/create-checkout-session", async (req, res) => {
    //   const session = await stripe.checkout.sessions.create({
    //     ui_mode: "custom",
    //     line_items: [{
    //       price_data: {
    //         product_data: {
    //           name: "Your Product",
    //         },
    //         currency: "usd",
    //         unit_amount: 2000,
    //       },
    //       quantity: 1,
    //     }],
    //     mode: "payment",
    //     return_url: `${YOUR_DOMAIN}/complete?session_id={CHECKOUT_SESSION_ID}`,
    //   });

    //   res.send({ clientSecret: session.client_secret });
    // });


app.post("/create-payment-intent", async (req, res) => {
  try {
    const { price } = req.body;
    const amount = Math.round(price * 100); // USD cents

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "usd",
      payment_method_types: ["card"],
    });

    res.send({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: error.message });
  }
});






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
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
    await client.connect();


    const mansCollection = client.db('manstyle').collection('manproducts')
    const ordersCollection = client.db("manstyle").collection("orders");
    const usersCollection = client.db("manstyle").collection("users");



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



    // Get all orders (optional, for admin view)
    app.get("/orders", async (req, res) => {
      try {
        const orders = await ordersCollection.find().toArray();
        console.log("✅ All orders fetched:", orders);
        res.send(orders);
      } catch (error) {
        console.error("❌ Error fetching all orders:", error);
        res.status(500).send({ error: error.message });
      }
    });






    app.get("/orders/pending", async (req, res) => {
      console.log("✅ /orders/pending route hit");
      try {
        const pendingOrders = await ordersCollection.find({ status: "pending" }).toArray();
        console.log("Pending orders:", pendingOrders);
        res.send(pendingOrders);
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: error.message });
      }
    });




    app.get("/orders/approved", async (req, res) => {
      const approvedOrders = await ordersCollection.find({ status: "approved" }).toArray();
      res.send(approvedOrders);
    });



    app.put("/orders/approve/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await ordersCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: "approved" } }
        );
        res.send(result);
      } catch (error) {
        console.error("Error approving order:", error);
        res.status(500).send({ error: "Failed to approve order" });
      }
    });

    app.put("/orders/reject/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await ordersCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: "rejected" } }
        );
        res.send(result);
      } catch (error) {
        console.error("❌ Failed to reject order:", error);
        res.status(500).send({ error: "Failed to reject order" });
      }
    });





    // ✅ GET orders by user email
    app.get("/orders/:email", async (req, res) => {
      const email = req.params.email;
      const orders = await ordersCollection.find({ userEmail: email }).toArray();
      res.send(orders);
    });









    // payment api


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


    // 💾 1️⃣ পেমেন্ট ইনফো ডাটাবেজে সেভ করা
    app.post("/payments", async (req, res) => {
      try {
        const paymentInfo = req.body;
        const paymentsCollection = client.db("manstyle").collection("payments");
        const result = await paymentsCollection.insertOne(paymentInfo);
        res.send({ success: true, insertedId: result.insertedId });
      } catch (error) {
        console.error("Payment save error:", error);
        res.status(500).send({ success: false, error: error.message });
      }
    });

    // 📤 2️⃣ ইউজারের সব পেমেন্ট দেখা
    app.get("/payments", async (req, res) => {
      try {
        const email = req.query.email;
        const paymentsCollection = client.db("manstyle").collection("payments");

        const query = email ? { userEmail: email } : {};
        const payments = await paymentsCollection.find(query).toArray();

        res.send(payments);
      } catch (error) {
        console.error("Get payments error:", error);
        res.status(500).send({ error: error.message });
      }
    });


    // ✅ Get all users with optional search



    app.post("/users", async (req, res) => {
      try {
        const user = req.body;
        if (!user.email) return res.status(400).send({ error: "Email is required" });

        // আগে check করো user আগে থেকে আছে কি না
        const existingUser = await usersCollection.findOne({ email: user.email });
        if (existingUser) {
          return res.send({ message: "User already exists" });
        }

        const result = await usersCollection.insertOne(user);
        res.send({ success: true, userId: result.insertedId });
      } catch (error) {
        console.error("Error adding user:", error);
        res.status(500).send({ error: error.message });
      }
    });



    app.get("/users", async (req, res) => {
      try {
        const search = req.query.search || "";
        const query = {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
          ],
        };
        const users = await usersCollection.find(query).toArray();
        res.send(users);
      } catch (error) {
        console.error("Get users error:", error);
        res.status(500).send({ error: error.message });
      }
    });

    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      try {
        const user = await usersCollection.findOne({ email });
        if (user) {
          res.send({ role: user.role || "user" });
        } else {
          res.send({ role: "user" });
        }
      } catch (error) {
        console.error("❌ Error fetching user role:", error);
        res.status(500).send({ error: error.message });
      }
    });


    // ✅ Make user admin
    app.put("/users/role/admin/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const result = await usersCollection.updateOne(
          { email },
          { $set: { role: "admin" } }
        );
        res.send({ success: result.modifiedCount > 0 });
      } catch (error) {
        console.error("Update user role error:", error);
        res.status(500).send({ error: error.message });
      }
    });




    // ✅ Make user admin (by ID or email)
    app.put("/users/make-admin/:id", async (req, res) => {
      try {
        const id = req.params.id;

        // ObjectId হলে ID দিয়ে, নাহলে email দিয়ে খোঁজা
        const query = ObjectId.isValid(id)
          ? { _id: new ObjectId(id) }
          : { email: id };

        const updateDoc = { $set: { role: "admin" } };
        const result = await usersCollection.updateOne(query, updateDoc);

        if (result.modifiedCount > 0) {
          res.send({ success: true, message: "User promoted to admin successfully ✅" });
        } else {
          res.send({ success: false, message: "No user found or already admin" });
        }
      } catch (error) {
        console.error("❌ Update user role error:", error);
        res.status(500).send({ error: error.message });
      }
    });




    app.put("/users/remove-admin/:id", async (req, res) => {
      const { id } = req.params;
      try {
        const result = await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { role: "user" } }
        );

        if (result.modifiedCount > 0) {
          res.send({ success: true, message: "Admin role removed" });
        } else {
          res.send({ success: false, message: "No changes made" });
        }
      } catch (error) {
        console.error("Error removing admin:", error);
        res.status(500).send({ success: false, message: "Server error" });
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
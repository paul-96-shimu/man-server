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
app.use(cors({
  origin: [
    "http://localhost:5173",                // লোকালহোস্ট
    "https://y-three-blond.vercel.app"      // Vercel frontend
  ],
  methods: "GET,POST,PUT,DELETE",
  credentials: true
}));

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
    const reviewsCollection = client.db("manstyle").collection("reviews");
    const addressesCollection = client.db("manstyle").collection("addresses");





    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (!user || user.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden access' });
      } next();
    }


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");



    // man api



    // Products Collection
    // const productsCollection = client.db("man_style").collection("products");

    // 🔹 Add New Product API
    app.post("/products", async (req, res) => {
      try {
        const product = req.body;

        // Validation: images field expect করা হচ্ছে
        if (!product.title || !product.price || !product.category || !product.images) {
          return res.status(400).json({ message: "All fields are required" });
        }

        // Optional: slug, createdAt, updatedAt auto generate
        const slug = product.title.toLowerCase().split(" ").join("-");
        const now = new Date();
        const productWithMeta = {
          ...product,
          slug,
          createdAt: now,
          updatedAt: now,
        };

        const result = await mansCollection.insertOne(productWithMeta);

        res.send({
          success: true,
          insertedId: result.insertedId,
          message: "Product added successfully",
        });
      } catch (error) {
        console.error("❌ Error adding product:", error);
        res.status(500).json({ success: false, message: "Failed to add product" });
      }
    });


    app.get("/products", async (req, res) => {
      const result = await mansCollection.find().toArray();
      res.send(result);
    });



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






    app.get("/orders/pending", verifyAdmin, async (req, res) => {
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




    app.get("/orders/approved", verifyAdmin, async (req, res) => {
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



    app.get("/orders/single/:id", async (req, res) => {
      const id = req.params.id;

      try {
        const order = await ordersCollection.findOne({ _id: new ObjectId(id) });

        res.send(order);
      } catch (error) {
        res.status(500).send({ message: "Error loading order", error });
      }
    });




    app.put("/orders/update/:id", async (req, res) => {
      const id = req.params.id;

      // Validate ObjectId
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid order ID" });
      }

      // Remove _id from update data
      const { _id, ...updatedData } = req.body;

      try {
        const result = await ordersCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedData }
        );

        if (result.modifiedCount === 0) {
          return res.status(404).send({ message: "Order not found or nothing updated" });
        }

        res.send({ message: "Order updated successfully" });
      } catch (error) {
        console.error("Update error:", error);
        res.status(500).send({ message: "Internal Server Error", error });
      }
    });



    // ✅ GET orders by user email
    app.get("/orders/:email", async (req, res) => {
      const email = req.params.email;
      const orders = await ordersCollection.find({ userEmail: email }).toArray();
      res.send(orders);
    });






    // Update Order API







    // Delete Order API
    app.delete("/orders/delete/:id", async (req, res) => {
      const id = req.params.id;

      try {
        const result = await ordersCollection.deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 0) {
          return res.status(404).send({ message: "Order not found" });
        }

        res.send({ message: "Order deleted successfully" });
      } catch (error) {
        res.status(500).send({ message: "Error deleting order", error });
      }
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



    app.get("/today-summary", async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const todayPayments = await ordersCollection.find({
      date: { $gte: today, $lt: tomorrow }
    }).toArray();

    const totalSellAmount = todayPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalSellQuantity = todayPayments.reduce((sum, p) => sum + p.quantity, 0);

    res.send({
      totalSellAmount,
      totalSellQuantity,
      totalOrders: todayPayments.length
    });

  } catch (err) {
    res.status(500).send({ error: err.message });
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
        const { name, email, phone, image } = req.body;

        // Email required check
        if (!email) return res.status(400).send({ error: "Email is required" });

        // Check if user already exists
        const existingUser = await usersCollection.findOne({ email: email });
        if (existingUser) {
          return res.status(200).send({ message: "User already exists", user: existingUser });
        }

        // Prepare user object
        const newUser = {
          name: name || "User",
          email,
          phone: phone || "",
          image: image || "",
          role: "user",      // default role 
          createdAt: new Date()
        };

        // Insert into MongoDB
        const result = await usersCollection.insertOne(newUser);

        res.status(201).send({ success: true, userId: result.insertedId, user: newUser });
      } catch (error) {
        console.error("Error adding user:", error);
        res.status(500).send({ error: error.message });
      }
    });






    app.put("/users/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const updatedData = req.body;

        const result = await usersCollection.updateOne(
          { email },
          { $set: updatedData }
        );

        res.send({ success: true, result });
      } catch (error) {
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






    // app.get("/users/:email",async (req, res) => {
    //   try {
    //     const email = req.params.email;

    //     const user = await usersCollection.findOne({ email });

    //     if (!user) {
    //       return res.status(404).send({ error: "User not found" });
    //     }

    //     res.send({
    //       success: true,
    //       user
    //     });
    //   } catch (error) {
    //     console.error("❌ Error fetching user:", error);
    //     res.status(500).send({ error: error.message });
    //   }
    // });







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
    app.put("/users/role/admin/:email", verifyAdmin, async (req, res) => {
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
    app.put("/users/make-admin/:id", verifyAdmin, async (req, res) => {
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




    app.put("/users/remove-admin/:id", verifyAdmin, async (req, res) => {
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




    // ===== Reviews collection =====


    // Add review (one review per user per product)
    // Add a new review
    app.post("/reviews", async (req, res) => {
      const reviewsCollection = client.db("manstyle").collection("reviews");
      const review = req.body;

      // review must have productId, userName, userEmail, reviewText, rating
      if (!review.productId || !review.userName || !review.userEmail || !review.reviewText || !review.rating) {

        console.log("Invalid review received:", review);
        return res.status(400).send({ success: false, message: "Missing required fields" });
      }

      review.timestamp = new Date();

      try {
        const result = await reviewsCollection.insertOne(review);
        res.send({ success: true, insertedId: result.insertedId });
      } catch (error) {
        console.error("Error saving review:", error);
        res.status(500).send({ success: false, error: error.message });
      }
    });


    // Get reviews for a product (latest first)
    app.get("/reviews/:productId", async (req, res) => {
      try {
        const productId = req.params.productId;
        const reviews = await reviewsCollection
          .find({ productId })
          .sort({ reviewDate: -1 })
          .toArray();
        res.send(reviews);
      } catch (error) {
        console.error("Get product reviews error:", error);
        res.status(500).send({ error: error.message });
      }
    });

    // Get reviews by user (optional)
    app.get("/reviews/user/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const reviews = await reviewsCollection.find({ userEmail: email }).toArray();
        res.send(reviews);
      } catch (error) {
        console.error("Get user reviews error:", error);
        res.status(500).send({ error: error.message });
      }
    });

    // Update review (only same user can update) - expects userEmail in body to verify
    app.patch("/reviews/update/:id", async (req, res) => {
      try {
        const id = req.params.id;
        if (!ObjectId.isValid(id)) return res.status(400).send({ message: "Invalid review id" });

        const { rating, comment, userEmail } = req.body;
        if (!userEmail) return res.status(400).send({ message: "userEmail is required to verify ownership" });

        // verify ownership
        const existing = await reviewsCollection.findOne({ _id: new ObjectId(id) });
        if (!existing) return res.status(404).send({ message: "Review not found" });
        if (existing.userEmail !== userEmail) {
          return res.status(403).send({ message: "You are not allowed to update this review" });
        }

        const updateDoc = {};
        if (rating !== undefined) updateDoc.rating = Number(rating);
        if (comment !== undefined) updateDoc.comment = comment;
        updateDoc.reviewDate = new Date();

        const result = await reviewsCollection.findOneAndUpdate(
          { _id: new ObjectId(id) },
          { $set: updateDoc },
          { returnDocument: "after" }
        );

        res.send({ success: true, message: "Review updated", review: result.value });
      } catch (error) {
        console.error("Update review error:", error);
        res.status(500).send({ success: false, error: error.message });
      }
    });

    // Delete review (only same user can delete) - expects userEmail in body or query to verify
    app.delete("/reviews/delete/:id", async (req, res) => {
      try {
        const id = req.params.id;
        if (!ObjectId.isValid(id)) return res.status(400).send({ message: "Invalid review id" });

        // ownership verification: prefer body.userEmail, fallback to query.userEmail
        const userEmail = req.body?.userEmail || req.query?.userEmail;
        if (!userEmail) return res.status(400).send({ message: "userEmail required to verify ownership" });

        const existing = await reviewsCollection.findOne({ _id: new ObjectId(id) });
        if (!existing) return res.status(404).send({ message: "Review not found" });
        if (existing.userEmail !== userEmail) {
          return res.status(403).send({ message: "You are not allowed to delete this review" });
        }

        const result = await reviewsCollection.deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) {
          return res.status(404).send({ message: "Review not found or already deleted" });
        }

        res.send({ success: true, message: "Review deleted" });
      } catch (error) {
        console.error("Delete review error:", error);
        res.status(500).send({ success: false, error: error.message });
      }
    });

    // Optional: create index for faster product queries (run once)
    reviewsCollection.createIndex({ productId: 1, userEmail: 1 });






    // Get single order details
    app.get("/orders/details/:id", async (req, res) => {
      const ordersCollection = client.db("manstyle").collection("orders");
      const id = req.params.id;

      try {
        const query = { _id: new ObjectId(id) };
        const order = await ordersCollection.findOne(query);

        if (!order) {
          return res.status(404).send({ success: false, message: "Order not found" });
        }

        res.send({ success: true, order });
      } catch (error) {
        console.error("Error fetching order details:", error);
        res.status(500).send({ success: false, error: error.message });
      }
    });


    // address api


    app.post("/addresses", async (req, res) => {
      try {
        const address = req.body;
        const result = await addressesCollection.insertOne(address);
        res.send({ success: true, id: result.insertedId });
      } catch (err) {
        res.status(500).send({ error: err.message });
      }
    });

    app.get("/addresses/:email", async (req, res) => {
      const email = req.params.email;
      const result = await addressesCollection.find({ email }).toArray();
      res.send(result);
    });




    // PUT /addresses/:id

    app.put("/addresses/:id", async (req, res) => {
      try {
        const id = new ObjectId(req.params.id);
        const updateData = req.body;

        const result = await addressesCollection.findOneAndUpdate(
          { _id: id },
          { $set: updateData },
          { returnDocument: "after" } // 🔥 returns updated document
        );

        res.send(result.value); // send updated address back to frontend
      } catch (err) {
        res.status(500).send({ error: err.message });
      }
    });

    app.delete("/addresses/:id", async (req, res) => {
      const id = new ObjectId(req.params.id);
      const result = await addressesCollection.deleteOne({ _id: id });
      res.send(result);
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



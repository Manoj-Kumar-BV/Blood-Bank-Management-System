const mongoose=require("mongoose")

mongoose.connect(process.env.MONGO).then(()=>{
console.log("Successfully connected to mongodb");
}).catch((err)=>{
  console.log(err);
  
})

const DonorSchema=mongoose.Schema({key:Number,report:String})

const Donorfeedback=mongoose.model("Donor",DonorSchema)


const AdminSchema=mongoose.Schema({username:String,password:String})
const Admin=mongoose.model("admin",AdminSchema)


module.exports={Donorfeedback,Admin}
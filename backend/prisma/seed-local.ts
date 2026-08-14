import { PrismaClient, UserRole } from "@prisma/client";
import { createHash, scryptSync, randomBytes } from "crypto";

const db=new PrismaClient();
const normalize=(value:string)=>{const digits=value.replace(/\D/g,"");return digits.startsWith("254")?`+${digits}`:`+254${digits.slice(1)}`};
const phoneHash=(value:string)=>createHash("sha256").update(normalize(value)).digest("hex");
const passwordHash=(value:string)=>{const salt=randomBytes(16).toString("hex");return `scrypt:${salt}:${scryptSync(value,salt,64).toString("hex")}`};
type Person={name:string;phone:string;password:string;role:UserRole};

async function account(person:Person){const normalized=normalize(person.phone);const email=`seed-${normalized.replace(/\D/g,"")}@example.test`;let user=await db.user.findFirst({where:{phoneHash:phoneHash(normalized)}});if(!user){user=await db.user.create({data:{email,emailVerifiedAt:new Date(),phoneHash:phoneHash(normalized),phoneEncrypted:Buffer.from(normalized),role:person.role,status:"ACTIVE",verifiedAt:new Date()}})}await db.appAccount.upsert({where:{id:user.id},create:{id:user.id,displayName:person.name,passwordHash:passwordHash(person.password)},update:{displayName:person.name,passwordHash:passwordHash(person.password)}});if(person.role==="LANDLORD")await db.landlordProfile.upsert({where:{userId:user.id},create:{userId:user.id,displayName:person.name,verificationState:"APPROVED"},update:{displayName:person.name,verificationState:"APPROVED"}});if(person.role==="AGENT")await db.agentProfile.upsert({where:{userId:user.id},create:{userId:user.id,agencyName:person.name,verificationState:"APPROVED"},update:{agencyName:person.name,verificationState:"APPROVED"}});return user}

async function listing(ownerId:string,item:{title:string;description:string;county:string;town:string;area:string;type:string;beds:number;baths:number;size:number;rent:number}){if(await db.listing.findFirst({where:{title:item.title,unit:{property:{ownerId}}}}))return;await db.listing.create({data:{title:item.title,description:item.description,status:"PUBLISHED",verificationState:"APPROVED",publishedAt:new Date(),expiresAt:new Date(Date.now()+45*86400_000),unit:{create:{unitType:item.type,bedrooms:item.beds,bathrooms:item.baths,sizeSquareMetres:item.size,monthlyRentKes:item.rent,depositKes:item.rent,amenities:["Reliable water","Security","Parking"],availability:"AVAILABLE",property:{create:{ownerId,county:item.county,town:item.town,approximateArea:item.area,exactAddressEncrypted:Buffer.from(`${item.area} private address`),exactCoordinatesEncrypted:Buffer.from("private coordinates"),contactEncrypted:Buffer.from("+254700000000")}}}}}})}

async function main(){
  await db.unlockFeeConfig.upsert({where:{id:"default"},create:{id:"default",rate:0.025,floorKes:100,ceilingKes:800},update:{}});
  await account({name:"Denis Admin",phone:"0759405137",password:"Denis%",role:"ADMIN"});
  const landlords=await Promise.all([
    account({name:"Amina Kamau",phone:"0711000001",password:"Landlord1!",role:"LANDLORD"}),
    account({name:"Brian Otieno",phone:"0711000002",password:"Landlord2!",role:"LANDLORD"}),
    account({name:"Faith Wanjiku",phone:"0711000003",password:"Landlord3!",role:"LANDLORD"})
  ]);
  await Promise.all([
    listing(landlords[0].id,{title:"Sunlit Kilimani two-bedroom",description:"A bright and quiet apartment close to shops, buses and everyday services.",county:"Nairobi",town:"Nairobi",area:"Kilimani",type:"2 Bedroom",beds:2,baths:2,size:86,rent:52000}),
    listing(landlords[0].id,{title:"Modern Westlands one-bedroom",description:"Secure modern home with reliable water, lift access and convenient transport.",county:"Nairobi",town:"Nairobi",area:"Westlands",type:"1 Bedroom",beds:1,baths:1,size:55,rent:43000}),
    listing(landlords[1].id,{title:"Spacious Nyali three-bedroom",description:"Family-friendly coastal apartment with balcony, parking and nearby shopping.",county:"Mombasa",town:"Mombasa",area:"Nyali",type:"3 Bedroom",beds:3,baths:2,size:128,rent:68000}),
    listing(landlords[1].id,{title:"Affordable Bamburi bedsitter",description:"Clean self-contained bedsitter in a convenient area with dependable transport.",county:"Mombasa",town:"Mombasa",area:"Bamburi",type:"Bedsitter",beds:0,baths:1,size:27,rent:11000}),
    listing(landlords[2].id,{title:"Garden apartment in Ruaka",description:"Comfortable two-bedroom apartment near the bypass with parking and security.",county:"Kiambu",town:"Kiambu",area:"Ruaka",type:"2 Bedroom",beds:2,baths:2,size:78,rent:36000}),
    listing(landlords[2].id,{title:"Quiet Nakuru one-bedroom",description:"Well maintained home near the town centre with water storage and a caretaker.",county:"Nakuru",town:"Nakuru",area:"Section 58",type:"1 Bedroom",beds:1,baths:1,size:48,rent:18000})
  ]);
  const agent=await account({name:"Mwangaza Property Agency",phone:"0733000001",password:"Agent1!",role:"AGENT"});
  await listing(agent.id,{title:"Agent-managed Kasarani apartment",description:"A professionally managed two-bedroom apartment near public transport and shops.",county:"Nairobi",town:"Nairobi",area:"Kasarani",type:"2 Bedroom",beds:2,baths:1,size:68,rent:28000});
  await Promise.all([
    account({name:"Kevin Mwangi",phone:"0722000001",password:"Visitor1!",role:"TENANT"}),
    account({name:"Mercy Achieng",phone:"0722000002",password:"Visitor2!",role:"TENANT"}),
    account({name:"John Mutua",phone:"0722000003",password:"Visitor3!",role:"TENANT"})
  ]);
  console.log("Seeded 1 admin, 3 landlords, 1 agent, 3 clients and 7 listings.");
}
main().finally(()=>db.$disconnect());

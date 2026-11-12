/* ==========================================================
   AutoDrive PK — Demo data & site configuration
   NOTE: All listings are SAMPLE / DEMO data. Replace the
   whatsapp number and inventory before going live.
   ========================================================== */

window.SITE = {
  name: "AutoDrive PK",
  // DEMO placeholder number — replace with your real business number.
  whatsapp: "923000002886",
  phone: "+92 300 0002886",
  email: "hello@autodrive.pk",
  city: "Karachi",
  // Used to build an EMI hint on cards
  finance: { downPayment: 0.3, years: 5, annualRate: 0.18 }
};

const U = "https://images.unsplash.com/";
const img = (id, w = 1000) => `${U}${id}?auto=format&fit=crop&w=${w}&q=70`;

window.CARS = [
  {
    id: "civic-rs-2023",
    make: "Honda",
    model: "Civic RS Turbo",
    variant: "1.5 VTEC Turbo CVT",
    year: 2023,
    city: "Karachi",
    area: "DHA Phase 6",
    price: 8950000,
    mileage: 18500,
    fuel: "Petrol",
    transmission: "Automatic",
    body: "Sedan",
    color: "Crystal Black Pearl",
    registered: "Sindh",
    owners: "1st owner",
    condition: "Total genuine",
    badge: "Verified",
    score: 9.6,
    image: img("photo-1552519507-da3b142c6e3d"),
    gallery: [
      img("photo-1552519507-da3b142c6e3d", 1400),
      img("photo-1549317661-bd32c8ce0db2", 1400),
      img("photo-1503376780353-7e6692767b70", 1400),
      img("photo-1541899481282-d53bffe3c35d", 1400)
    ],
    features: ["Honda Sensing", "Sunroof", "Apple CarPlay & Android Auto", "Dual-zone climate", "Paddle shifters", "6 airbags", "LED headlamps", "Push start"],
    description:
      "Single owner Civic RS Turbo maintained at an authorised Honda dealership in Karachi. Complete service history booklet, both original keys and Sindh smart card available for verification. Paint depth is factory-original on all panels.",
    seller: { name: "Malik Muhammad Farooq", type: "Private seller", since: "2021", deals: 7 }
  },
  {
    id: "land-cruiser-zx-2022",
    make: "Toyota",
    model: "Land Cruiser ZX",
    variant: "3.5L Twin Turbo 4x4",
    year: 2022,
    city: "Islamabad",
    area: "F-7",
    price: 34500000,
    mileage: 24500,
    fuel: "Petrol",
    transmission: "Automatic",
    body: "SUV",
    color: "Attitude Black",
    registered: "Islamabad",
    owners: "1st owner",
    condition: "Zero paint work",
    badge: "Featured",
    score: 9.8,
    image: img("photo-1519641471654-76ce0107ad1b"),
    gallery: [
      img("photo-1519641471654-76ce0107ad1b", 1400),
      img("photo-1502877338535-766e1452684a", 1400),
      img("photo-1494976388531-d1058494cdd8", 1400),
      img("photo-1544636331-e26879cd4d9b", 1400)
    ],
    features: ["Full option ZX", "360° camera", "Sunroof", "Nappa leather", "Adaptive cruise", "Cool box", "Head-up display", "4-zone climate"],
    description:
      "Unregistered 2022 Land Cruiser ZX imported on a fresh auction sheet. Zero meter equivalent condition, complete auction documentation and biometric-ready transfer. Inspection report available on request.",
    seller: { name: "AutoDrive Premier Desk", type: "Verified dealer", since: "2019", deals: 64 }
  },
  {
    id: "sportage-awd-2023",
    make: "Kia",
    model: "Sportage AWD",
    variant: "Alpha Pack 2.0",
    year: 2023,
    city: "Lahore",
    area: "Gulberg III",
    price: 11800000,
    mileage: 16200,
    fuel: "Petrol",
    transmission: "Automatic",
    body: "SUV",
    color: "Snow White Pearl",
    registered: "Punjab",
    owners: "1st owner",
    condition: "Bumper to bumper original",
    badge: "Inspected",
    score: 9.4,
    image: img("photo-1511919884226-fd3cad34687c"),
    gallery: [
      img("photo-1511919884226-fd3cad34687c", 1400),
      img("photo-1580273916550-e323be2ae537", 1400),
      img("photo-1550355291-bbee04a92027", 1400),
      img("photo-1552519507-da3b142c6e3d", 1400)
    ],
    features: ["Panoramic sunroof", "AWD", "Leather interior", "Electronic parking brake", "Wireless charger", "Blind-spot monitor", "Ventilated seats", "360° camera"],
    description:
      "Family-driven Sportage Alpha with complete Kia service record. Non-accidental, original paint on every panel and lifetime token tax paid. Ideal daily drive with AWD confidence.",
    seller: { name: "Zainab Malik", type: "Private seller", since: "2022", deals: 3 }
  },
  {
    id: "alto-vxl-2022",
    make: "Suzuki",
    model: "Alto VXL",
    variant: "660cc AGS",
    year: 2022,
    city: "Rawalpindi",
    area: "Saddar",
    price: 2980000,
    mileage: 42000,
    fuel: "Petrol",
    transmission: "Automatic",
    body: "Hatchback",
    color: "Solid White",
    registered: "Rawalpindi",
    owners: "2nd owner",
    condition: "Minor touch-ups",
    badge: "Value pick",
    score: 8.9,
    image: img("photo-1541899481282-d53bffe3c35d"),
    gallery: [
      img("photo-1541899481282-d53bffe3c35d", 1400),
      img("photo-1503376780353-7e6692767b70", 1400),
      img("photo-1552519507-da3b142c6e3d", 1400)
    ],
    features: ["AGS auto gearbox", "Power windows", "Power steering", "AC", "Alloy rims", "Immobiliser"],
    description:
      "Budget-friendly Alto VXL with AGS transmission, ideal for city commuting. Two panels touched up, mechanically sound with clean documents and paid token tax.",
    seller: { name: "Hamza Farooq", type: "Private seller", since: "2023", deals: 2 }
  },
  {
    id: "fortuner-legender-2021",
    make: "Toyota",
    model: "Fortuner Legender",
    variant: "2.8 Sigma 4 Diesel",
    year: 2021,
    city: "Lahore",
    area: "DHA Phase 5",
    price: 21500000,
    mileage: 52000,
    fuel: "Diesel",
    transmission: "Automatic",
    body: "SUV",
    color: "Pearl White",
    registered: "Punjab",
    owners: "1st owner",
    condition: "Total genuine",
    badge: "Verified",
    score: 9.5,
    image: img("photo-1533473359331-0135ef1b58bf"),
    gallery: [
      img("photo-1533473359331-0135ef1b58bf", 1400),
      img("photo-1519641471654-76ce0107ad1b", 1400),
      img("photo-1494976388531-d1058494cdd8", 1400)
    ],
    features: ["Sigma 4", "Diesel", "Sunroof", "Leather seats", "Cruise control", "Reverse camera", "Alloy rims", "Fog lamps"],
    description:
      "Legender diesel with documented service history and original paint. Long-distance driven on motorways only. Token tax paid and transfer ready.",
    seller: { name: "Barrister Shaharyar Ali", type: "Private seller", since: "2020", deals: 5 }
  },
  {
    id: "tucson-awd-2022",
    make: "Hyundai",
    model: "Tucson AWD",
    variant: "Ultimate 2.0",
    year: 2022,
    city: "Islamabad",
    area: "Blue Area",
    price: 14200000,
    mileage: 31000,
    fuel: "Petrol",
    transmission: "Automatic",
    body: "SUV",
    color: "Amazon Gray",
    registered: "Islamabad",
    owners: "1st owner",
    condition: "Original paint",
    badge: "Inspected",
    score: 9.3,
    image: img("photo-1550355291-bbee04a92027"),
    gallery: [
      img("photo-1550355291-bbee04a92027", 1400),
      img("photo-1580273916550-e323be2ae537", 1400),
      img("photo-1511919884226-fd3cad34687c", 1400)
    ],
    features: ["HTRAC AWD", "Brown leather", "Panoramic roof", "Wireless charging", "Smart key", "Lane keep assist", "Dual-zone climate", "Rear AC vents"],
    description:
      "Top-spec Tucson Ultimate with HTRAC AWD and full Hyundai Nishat service history. Non-accidental, single owner, ready for biometric transfer.",
    seller: { name: "Faisal Khan", type: "Private seller", since: "2021", deals: 4 }
  },
  {
    id: "elantra-gls-2023",
    make: "Hyundai",
    model: "Elantra GLS",
    variant: "2.0 Nu MPI",
    year: 2023,
    city: "Karachi",
    area: "Clifton",
    price: 7150000,
    mileage: 12100,
    fuel: "Petrol",
    transmission: "Automatic",
    body: "Sedan",
    color: "Silver Metallic",
    registered: "Sindh",
    owners: "1st owner",
    condition: "Total genuine",
    badge: "Verified",
    score: 9.6,
    image: img("photo-1555215695-3004980ad54e"),
    gallery: [
      img("photo-1555215695-3004980ad54e", 1400),
      img("photo-1552519507-da3b142c6e3d", 1400),
      img("photo-1549317661-bd32c8ce0db2", 1400)
    ],
    features: ["Sunroof", "Leather seats", "Apple CarPlay", "Rear camera", "Cruise control", "Push start", "LED lights", "Alloy rims"],
    description:
      "Low-mileage Elantra GLS in showroom condition. Garage kept, non-smoker, all original panels. Perfect executive sedan for daily use.",
    seller: { name: "Syed Bilal Ahmed", type: "Private seller", since: "2022", deals: 2 }
  },
  {
    id: "c200-amg-2021",
    make: "Mercedes-Benz",
    model: "C200 AMG",
    variant: "AMG Line",
    year: 2021,
    city: "Lahore",
    area: "DHA Phase 6",
    price: 18800000,
    mileage: 26000,
    fuel: "Petrol",
    transmission: "Automatic",
    body: "Sedan",
    color: "Obsidian Black",
    registered: "Punjab",
    owners: "1st owner",
    condition: "Zero paint work",
    badge: "Featured",
    score: 9.7,
    image: img("photo-1618843479313-40f8afb4b4d8"),
    gallery: [
      img("photo-1618843479313-40f8afb4b4d8", 1400),
      img("photo-1503376780353-7e6692767b70", 1400),
      img("photo-1494976388531-d1058494cdd8", 1400)
    ],
    features: ["AMG styling", "Digital cockpit", "Burmester audio", "Panoramic roof", "Memory seats", "Ambient lighting", "360° camera", "Keyless go"],
    description:
      "C200 AMG Line under company warranty until late 2026. Complete authorised workshop history, ceramic coated and garage kept. No accidents or paint work.",
    seller: { name: "AutoDrive Premier Desk", type: "Verified dealer", since: "2019", deals: 64 }
  },
  {
    id: "swift-glx-2023",
    make: "Suzuki",
    model: "Swift GLX",
    variant: "1.2 CVT",
    year: 2023,
    city: "Faisalabad",
    area: "Canal Road",
    price: 6450000,
    mileage: 14800,
    fuel: "Petrol",
    transmission: "Automatic",
    body: "Hatchback",
    color: "Carmine Red",
    registered: "Punjab",
    owners: "1st owner",
    condition: "Original paint",
    badge: "Inspected",
    score: 9.2,
    image: img("photo-1580273916550-e323be2ae537"),
    gallery: [
      img("photo-1580273916550-e323be2ae537", 1400),
      img("photo-1541899481282-d53bffe3c35d", 1400),
      img("photo-1552519507-da3b142c6e3d", 1400)
    ],
    features: ["CVT", "Push start", "Cruise control", "6 airbags", "Climate control", "Alloy rims", "Rear camera", "Fog lamps"],
    description:
      "Top-variant Swift GLX with all factory features intact. First owner, complete file, genuine mileage and zero accidental history.",
    seller: { name: "Usman Tariq", type: "Private seller", since: "2022", deals: 3 }
  },
  {
    id: "prado-tx-2020",
    make: "Toyota",
    model: "Prado TX",
    variant: "2.7L Petrol",
    year: 2020,
    city: "Karachi",
    area: "DHA Phase 5",
    price: 28400000,
    mileage: 38000,
    fuel: "Petrol",
    transmission: "Automatic",
    body: "SUV",
    color: "Super White",
    registered: "Sindh",
    owners: "1st owner",
    condition: "Total genuine",
    badge: "Verified",
    score: 9.5,
    image: img("photo-1494976388531-d1058494cdd8"),
    gallery: [
      img("photo-1494976388531-d1058494cdd8", 1400),
      img("photo-1519641471654-76ce0107ad1b", 1400),
      img("photo-1533473359331-0135ef1b58bf", 1400)
    ],
    features: ["7 seats", "Sunroof", "Leather seats", "Reverse camera", "Cruise control", "Alloy rims", "Dual AC", "Fog lamps"],
    description:
      "Prado TX with clean auction sheet and verified mileage. Original paint, complete service record and Sindh registration. Inspection welcome at our Karachi hub.",
    seller: { name: "Mirza Tariq Khan", type: "Private seller", since: "2018", deals: 9 }
  },
  {
    id: "haval-jolion-2024",
    make: "Haval",
    model: "Jolion HEV",
    variant: "1.5 Hybrid",
    year: 2024,
    city: "Islamabad",
    area: "Sector F-10",
    price: 9200000,
    mileage: 6500,
    fuel: "Hybrid",
    transmission: "Automatic",
    body: "SUV",
    color: "Blue Metallic",
    registered: "Islamabad",
    owners: "1st owner",
    condition: "As new",
    badge: "Featured",
    score: 9.8,
    image: img("photo-1605559424843-9e4c228bf1c2"),
    gallery: [
      img("photo-1605559424843-9e4c228bf1c2", 1400),
      img("photo-1511919884226-fd3cad34687c", 1400),
      img("photo-1550355291-bbee04a92027", 1400)
    ],
    features: ["Hybrid", "Panoramic sunroof", "ADAS", "360° camera", "Leather seats", "Wireless charger", "LED headlamps", "Power tailgate"],
    description:
      "Nearly new Jolion HEV with company warranty, 6,500 genuine kilometres. Loaded with ADAS and panoramic roof, perfect urban hybrid SUV.",
    seller: { name: "Sazgar Motors Desk", type: "Verified dealer", since: "2023", deals: 18 }
  },
  {
    id: "corolla-altis-2022",
    make: "Toyota",
    model: "Corolla Altis Grande",
    variant: "1.8 CVT-i",
    year: 2022,
    city: "Lahore",
    area: "Model Town",
    price: 8350000,
    mileage: 24000,
    fuel: "Petrol",
    transmission: "Automatic",
    body: "Sedan",
    color: "Super White",
    registered: "Punjab",
    owners: "1st owner",
    condition: "Total genuine",
    badge: "Verified",
    score: 9.4,
    image: img("photo-1502877338535-766e1452684a"),
    gallery: [
      img("photo-1502877338535-766e1452684a", 1400),
      img("photo-1552519507-da3b142c6e3d", 1400),
      img("photo-1549317661-bd32c8ce0db2", 1400)
    ],
    features: ["Sunroof", "Leather seats", "Cruise control", "Push start", "Rear camera", "Alloy rims", "Climate control", "Fog lamps"],
    description:
      "Altis Grande with complete Toyota service history and original paint. Popular resale value, clean Punjab registration and ready transfer.",
    seller: { name: "Adeel Raza", type: "Private seller", since: "2021", deals: 4 }
  }
];

window.BRANDS = [
  { name: "Toyota", count: 4812 },
  { name: "Honda", count: 3140 },
  { name: "Suzuki", count: 2960 },
  { name: "Kia", count: 1480 },
  { name: "Hyundai", count: 1120 },
  { name: "Mercedes-Benz", count: 680 },
  { name: "BMW", count: 530 },
  { name: "Haval", count: 410 }
];

window.CITIES = ["Karachi", "Lahore", "Islamabad", "Rawalpindi", "Faisalabad", "Peshawar", "Multan"];

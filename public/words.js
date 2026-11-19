// Category data: "Name|word,word,..."  — a word may appear in several
// categories; the game accepts any reading that keeps the deal solvable.
const CATEGORY_DATA = `
Fruits|Apple,Banana,Orange,Lime,Lemon,Plum,Peach,Cherry,Grape,Mango,Kiwi,Pear,Date,Fig,Apricot,Melon,Coconut
Colors|Red,Orange,Lime,Plum,Peach,Violet,Lilac,Amber,Olive,Teal,Indigo,Navy,Coral,Rose,Ruby,Cherry,Gold,Silver,Mustard,Brown,Cream
Flowers|Rose,Violet,Lilac,Tulip,Daisy,Iris,Poppy,Orchid,Lily,Daffodil,Sunflower,Jasmine,Peony,Marigold
Gemstones|Ruby,Emerald,Sapphire,Diamond,Opal,Jade,Amber,Pearl,Topaz,Garnet,Onyx,Amethyst
Coding Languages|Python,Java,Ruby,Swift,Rust,Perl,Scala,Kotlin,Julia,Dart,Elixir,Haskell
Snakes|Python,Cobra,Viper,Mamba,Adder,Boa,Rattlesnake,Anaconda,Asp,Krait
Birds|Crane,Robin,Swift,Eagle,Hawk,Owl,Sparrow,Finch,Heron,Parrot,Falcon,Raven,Swallow,Kite,Jay,Lark,Duck,Turkey,Toucan,Macaw
Heavy Machinery|Crane,Bulldozer,Excavator,Forklift,Backhoe,Dump Truck,Steamroller,Tractor,Grader,Loader
Fish|Bass,Salmon,Trout,Tuna,Cod,Perch,Pike,Carp,Sole,Halibut,Mackerel,Sardine,Swordfish,Snapper
Instruments|Bass,Piano,Guitar,Violin,Drum,Flute,Harp,Cello,Trumpet,Organ,Oboe,Tuba,Banjo,Triangle,Horn,Recorder,Kazoo,Accordion
Planets|Mercury,Venus,Earth,Mars,Jupiter,Saturn,Uranus,Neptune
Elements|Mercury,Gold,Silver,Iron,Copper,Neon,Helium,Oxygen,Carbon,Tin,Lead,Zinc,Nickel
Roman Gods|Mercury,Venus,Mars,Jupiter,Saturn,Neptune,Pluto,Juno,Minerva,Vulcan,Apollo,Diana,Cupid
Playing Cards|Ace,King,Queen,Jack,Joker,Spade,Heart,Club,Diamond,Deck,Trump
Chess Terms|King,Queen,Bishop,Knight,Rook,Pawn,Checkmate,Castle,Gambit,Stalemate
Tools|Hammer,Wrench,Saw,Drill,Pliers,Chisel,Jack,Level,File,Screwdriver,Vise,Clamp,Mallet
Golf Terms|Club,Tee,Birdie,Eagle,Par,Bogey,Putt,Green,Fairway,Hole,Iron,Driver,Wedge,Caddie
Sports Gear|Bat,Racket,Ball,Net,Puck,Glove,Helmet,Paddle,Stick,Club,Skis,Goggles
Nocturnal Animals|Bat,Owl,Moth,Raccoon,Hedgehog,Possum,Firefly,Badger,Fox
Sea Mammals|Seal,Whale,Dolphin,Walrus,Otter,Manatee,Sea Lion,Narwhal,Orca
Office Supplies|Stapler,Pen,Pencil,Eraser,Ruler,Tape,Paper Clip,Folder,Binder,Marker,Scissors,Glue
Kitchen Utensils|Whisk,Spatula,Ladle,Tongs,Peeler,Grater,Colander,Rolling Pin,Sieve,Spoon,Fork,Knife
Breakfast|Pancake,Waffle,Bacon,Toast,Cereal,Omelet,Bagel,Muffin,Oatmeal,Croissant,Sausage,Granola
Pasta|Penne,Spaghetti,Fusilli,Rigatoni,Farfalle,Linguine,Macaroni,Ravioli,Lasagna,Orzo,Tortellini,Ziti
Cheeses|Cheddar,Brie,Gouda,Feta,Swiss,Parmesan,Mozzarella,Camembert,Ricotta,Stilton,Edam,American
Breads|Bagel,Baguette,Pita,Rye,Sourdough,Brioche,Naan,Ciabatta,Focaccia,Pretzel,Tortilla,Challah
Cocktails|Martini,Mojito,Margarita,Daiquiri,Manhattan,Negroni,Mimosa,Screwdriver,Gimlet,Sidecar,Old Fashioned
NYC Boroughs|Manhattan,Brooklyn,Queens,Bronx,Staten Island
Coffee Drinks|Espresso,Latte,Mocha,Cappuccino,Americano,Macchiato,Cortado,Flat White,Ristretto,Affogato
Spices|Cinnamon,Nutmeg,Pepper,Paprika,Cumin,Ginger,Clove,Saffron,Turmeric,Cardamom,Anise,Mustard
Herbs|Basil,Sage,Thyme,Rosemary,Mint,Parsley,Oregano,Dill,Cilantro,Chive,Bay Leaf,Tarragon
Girls' Names|Rose,Violet,Lily,Ruby,Pearl,Amber,Jasmine,Daisy,Iris,Olive,Ginger,Holly,Ivy,Hazel,Penny,Poppy,Rosemary,Sage,April,June,May,Diana,Julia
Months|January,February,March,April,May,June,July,August,September,October,November,December
Trees|Oak,Maple,Pine,Birch,Elm,Willow,Cedar,Ash,Spruce,Redwood,Palm,Hazel,Holly,Fir,Cherry,Olive
Weather|Rain,Snow,Hail,Sleet,Fog,Thunder,Lightning,Drizzle,Mist,Frost,Breeze,Storm,Hurricane,Tornado,Blizzard
Card Games|Poker,Bridge,Rummy,Solitaire,Hearts,Spades,Blackjack,Go Fish,Canasta,Cribbage,Euchre,War,Snap
Things With Keys|Piano,Keyboard,Typewriter,Padlock,Map,Organ,Accordion,Car,Door,Calculator,Florida
Things With Shells|Turtle,Snail,Egg,Peanut,Crab,Oyster,Clam,Taco,Walnut,Lobster,Armadillo,Pistachio,Coconut
Body Parts|Arm,Leg,Hand,Foot,Elbow,Knee,Shoulder,Ankle,Wrist,Hip,Chin,Nose,Ear,Palm,Heel
Furniture|Chair,Table,Sofa,Desk,Bed,Dresser,Bench,Stool,Cabinet,Bookshelf,Ottoman,Armchair,Futon
Empires|Roman,Ottoman,Mongol,Persian,Byzantine,Aztec,Inca,Mughal,British,Khmer
Dances|Waltz,Tango,Salsa,Foxtrot,Rumba,Samba,Polka,Swing,Jive,Cha-cha,Ballet,Flamenco,Twist,Charleston
Condiments|Ketchup,Mustard,Mayo,Salsa,Relish,Pesto,Soy Sauce,Sriracha,Tahini,Aioli,Gravy,Chutney,Hot Sauce
Dog Breeds|Poodle,Beagle,Boxer,Labrador,Bulldog,Dachshund,Collie,Terrier,Husky,Pug,Greyhound,Dalmatian,Corgi,Retriever
Athletes|Boxer,Sprinter,Golfer,Swimmer,Skier,Wrestler,Jockey,Gymnast,Fencer,Archer,Diver,Surfer,Cyclist
Jobs|Doctor,Teacher,Pilot,Chef,Nurse,Lawyer,Farmer,Baker,Plumber,Carpenter,Mechanic,Dentist,Judge,Barber
Structures|Bridge,Tower,Tunnel,Dam,Castle,Pyramid,Lighthouse,Skyscraper,Cathedral,Windmill,Barn,Fort
Computer Terms|Mouse,Keyboard,Monitor,Chip,Cursor,Virus,Bug,Cookie,Cloud,Web,Tablet,Window,Spam,Desktop
Rodents|Mouse,Rat,Hamster,Squirrel,Beaver,Gerbil,Chipmunk,Porcupine,Guinea Pig,Chinchilla,Vole,Marmot
Insects|Ant,Bee,Beetle,Butterfly,Moth,Fly,Wasp,Cricket,Grasshopper,Ladybug,Firefly,Dragonfly,Mosquito,Termite,Flea,Hornet
Sports|Cricket,Soccer,Tennis,Golf,Rugby,Hockey,Baseball,Basketball,Volleyball,Badminton,Polo,Squash,Lacrosse,Bowling,Croquet
Vegetables|Carrot,Potato,Squash,Broccoli,Spinach,Pea,Corn,Onion,Celery,Lettuce,Cabbage,Radish,Turnip,Beet,Kale,Leek,Pepper,Cucumber
Clothing|Shirt,Pants,Dress,Skirt,Jacket,Sweater,Scarf,Hat,Sock,Glove,Coat,Vest,Hoodie,Blouse,Tie
Footwear|Boot,Sandal,Slipper,Sneaker,Loafer,Clog,Heel,Flip-flop,Moccasin,Wedge,Pump,Oxford,Stiletto
Universities|Oxford,Cambridge,Harvard,Yale,Princeton,Stanford,Cornell,Duke,Brown,Columbia,Rice
Rivers|Nile,Amazon,Thames,Danube,Seine,Mississippi,Ganges,Yangtze,Rhine,Volga,Congo,Mekong,Jordan,Hudson,Columbia
Countries|France,Japan,Brazil,Chad,Jordan,Turkey,Chile,Peru,Egypt,Kenya,India,Canada,Georgia,Cuba,Norway,Greece,China,Panama,Congo
US States|Georgia,Texas,Ohio,Maine,Utah,Florida,Alaska,Nevada,Oregon,Montana,Vermont,Indiana,Virginia,Washington,Idaho,Kansas
Presidents|Washington,Lincoln,Adams,Jefferson,Madison,Monroe,Jackson,Grant,Kennedy,Carter,Taft,Polk,Truman,Ford,Bush
Capitals|Paris,London,Tokyo,Rome,Madrid,Berlin,Cairo,Lima,Oslo,Ottawa,Canberra,Nairobi,Athens,Dublin,Vienna,Moscow
Greek Letters|Alpha,Beta,Gamma,Delta,Epsilon,Theta,Lambda,Sigma,Omega,Pi,Rho,Tau,Psi,Zeta,Kappa
Math Terms|Pi,Sum,Root,Prime,Square,Cube,Angle,Ratio,Factor,Integer,Fraction,Vector,Matrix,Radius,Sine
Shapes|Circle,Square,Triangle,Cube,Sphere,Pyramid,Cone,Cylinder,Oval,Hexagon,Pentagon,Rectangle,Diamond,Star,Heart,Octagon
Space|Star,Comet,Meteor,Galaxy,Nebula,Asteroid,Moon,Sun,Black Hole,Quasar,Pulsar,Supernova
Zodiac Signs|Aries,Taurus,Gemini,Cancer,Leo,Virgo,Libra,Scorpio,Sagittarius,Capricorn,Aquarius,Pisces
Big Cats|Lion,Tiger,Leopard,Jaguar,Cheetah,Panther,Cougar,Lynx,Puma,Ocelot,Bobcat
Farm Animals|Cow,Pig,Sheep,Goat,Horse,Chicken,Duck,Donkey,Turkey,Goose,Llama,Rooster,Ox
Baby Animals|Kitten,Puppy,Calf,Foal,Cub,Lamb,Kid,Chick,Joey,Fawn,Duckling,Piglet,Tadpole,Cygnet
Sticky Things|Glue,Honey,Tape,Gum,Syrup,Jam,Sap,Taffy,Molasses,Caramel,Tar
Candy|Fudge,Toffee,Caramel,Taffy,Lollipop,Licorice,Gumdrop,Marshmallow,Nougat,Truffle,Brittle,Praline,Gum
Mushrooms|Truffle,Morel,Chanterelle,Shiitake,Portobello,Oyster,Button,Porcini,Enoki,Puffball
Shellfish|Oyster,Clam,Shrimp,Lobster,Crab,Mussel,Scallop,Prawn,Crayfish,Cockle
Sewing Kit|Needle,Thread,Button,Thimble,Pin,Bobbin,Zipper,Pattern,Scissors,Yarn,Spool
Weapons|Sword,Spear,Axe,Mace,Bow,Lance,Dagger,Halberd,Crossbow,Club,Saber,Trident
Hairstyles|Bob,Bun,Braid,Ponytail,Mohawk,Mullet,Pixie,Afro,Crew Cut,Buzz Cut,Bangs,Perm,Pompadour
Mythical Beasts|Dragon,Unicorn,Phoenix,Griffin,Mermaid,Troll,Goblin,Elf,Centaur,Pixie,Ogre,Kraken,Sphinx,Hydra,Yeti,Gnome
US Cities|Phoenix,Boston,Denver,Chicago,Dallas,Houston,Seattle,Miami,Austin,Portland,Atlanta,Detroit,Memphis,Nashville,Orlando
Boats|Canoe,Kayak,Yacht,Raft,Ferry,Sailboat,Submarine,Gondola,Barge,Tugboat,Schooner,Catamaran,Junk,Dinghy,Liner
Vehicles|Car,Bus,Truck,Van,Train,Tram,Taxi,Bicycle,Scooter,Motorcycle,Tractor,Limousine
Emotions|Joy,Anger,Fear,Sadness,Surprise,Envy,Pride,Love,Hope,Guilt,Shame,Disgust,Calm
Deadly Sins|Pride,Greed,Lust,Envy,Gluttony,Wrath,Sloth
Rainforest Animals|Sloth,Toucan,Jaguar,Parrot,Tapir,Anaconda,Tree Frog,Ocelot,Capybara,Macaw,Orangutan,Gorilla
Things That Buzz|Bee,Wasp,Hornet,Mosquito,Fly,Phone,Alarm Clock,Doorbell,Razor,Kazoo,Neon Sign
Hats|Beret,Fedora,Beanie,Bowler,Cap,Sombrero,Top Hat,Turban,Bonnet,Helmet,Cowboy Hat,Panama,Visor,Crown,Fez,Derby
Tennis Terms|Ace,Love,Deuce,Serve,Volley,Lob,Set,Match,Racket,Net,Fault,Rally,Smash
Music Genres|Jazz,Rock,Pop,Blues,Folk,Punk,Metal,Soul,Funk,Disco,Reggae,Country,Rap,Gospel,Techno,Swing,House
Rocks|Granite,Marble,Basalt,Slate,Limestone,Sandstone,Obsidian,Shale,Pumice,Chalk,Flint
Children's Games|Marbles,Tag,Hopscotch,Jacks,Hide and Seek,Jump Rope,Leapfrog,Simon Says,Red Rover,Hula Hoop
Writing Tools|Pen,Pencil,Chalk,Crayon,Marker,Quill,Highlighter,Charcoal,Stylus,Fountain Pen
Desserts|Pie,Cake,Cookie,Brownie,Pudding,Tart,Sundae,Cupcake,Cheesecake,Mousse,Sorbet,Cobbler,Trifle,Custard,Donut
Units|Inch,Foot,Mile,Yard,Meter,Pound,Ounce,Gallon,Liter,Acre,Ton,Pint,Quart,Gram,Second
Currencies|Dollar,Euro,Pound,Yen,Peso,Rupee,Franc,Mark,Lira,Ruble,Krona,Won,Rand,Dinar
House Parts|Roof,Attic,Basement,Garage,Porch,Kitchen,Chimney,Hallway,Window,Door,Staircase,Patio,Cellar,Yard,Deck
Ship Parts|Deck,Hull,Bow,Stern,Mast,Keel,Rudder,Anchor,Cabin,Galley,Bridge,Porthole,Sail,Helm
Tree Parts|Root,Trunk,Branch,Bark,Leaf,Twig,Bough,Sap,Crown,Knot,Ring,Limb,Cone
Things Dogs Do|Bark,Fetch,Sit,Wag,Howl,Beg,Growl,Sniff,Dig,Roll Over,Shake,Chew,Heel
Jewelry|Ring,Necklace,Bracelet,Earring,Brooch,Anklet,Pendant,Tiara,Locket,Cufflink,Bangle,Charm,Chain,Crown
Boxing Terms|Ring,Jab,Hook,Uppercut,Knockout,Punch,Round,Bell,Glove,Corner,Referee,Southpaw,Cross
Fishing Gear|Hook,Rod,Reel,Line,Bait,Lure,Net,Bobber,Sinker,Tackle,Fly,Waders
Football Terms|Tackle,Touchdown,Punt,Huddle,Fumble,Blitz,Quarterback,Field Goal,Kickoff,Sack,End Zone,Safety
Film Genres|Comedy,Drama,Horror,Western,Thriller,Romance,Musical,Documentary,Fantasy,Mystery,Action,Animation,Noir
Theater|Stage,Curtain,Script,Prop,Actor,Usher,Encore,Lobby,Audience,Balcony,Spotlight,Rehearsal,Intermission
Airplane Parts|Wing,Tail,Cockpit,Engine,Fuselage,Rudder,Propeller,Flap,Landing Gear,Aileron,Cabin,Galley
Bodies of Water|Ocean,Sea,Lake,Pond,River,Stream,Bay,Gulf,Lagoon,Creek,Fjord,Strait,Canal,Marsh,Brook
Landforms|Mountain,Valley,Canyon,Plateau,Desert,Island,Peninsula,Volcano,Hill,Cliff,Mesa,Glacier,Dune,Cave,Delta
Halloween|Ghost,Witch,Pumpkin,Bat,Skeleton,Vampire,Zombie,Costume,Candy,Broom,Cauldron,Werewolf,Mummy,Spider
Christmas|Tree,Star,Stocking,Reindeer,Ornament,Wreath,Holly,Tinsel,Elf,Sleigh,Candy Cane,Mistletoe,Snowman,Present
Beach Day|Towel,Umbrella,Sunscreen,Bucket,Shovel,Sandcastle,Surfboard,Flip-flop,Sunglasses,Cooler,Kite,Seashell
Camping Gear|Tent,Lantern,Compass,Sleeping Bag,Canteen,Flashlight,Hatchet,Map,Matches,Backpack,Stove,Cooler,Hammock
Car Parts|Engine,Wheel,Tire,Brake,Clutch,Bumper,Hood,Trunk,Muffler,Radiator,Horn,Mirror,Windshield,Axle,Gear
Bags|Suitcase,Backpack,Purse,Tote,Duffel,Satchel,Briefcase,Clutch,Trunk,Pouch,Wallet,Handbag
Garden Tools|Rake,Hoe,Shovel,Hose,Trowel,Wheelbarrow,Shears,Watering Can,Spade,Pitchfork,Sprinkler
Composers|Bach,Mozart,Beethoven,Chopin,Handel,Haydn,Vivaldi,Brahms,Verdi,Wagner,Liszt,Strauss,Debussy,Elgar
Painters|Picasso,Monet,Rembrandt,Van Gogh,Dali,Matisse,Renoir,Degas,Cezanne,Vermeer,Raphael,Warhol,Klimt
Shakespeare Plays|Hamlet,Macbeth,Othello,King Lear,Julius Caesar,Twelfth Night,The Tempest,Coriolanus,Cymbeline,Pericles
Salads|Caesar,Cobb,Waldorf,Greek,Caprese,Nicoise,Garden,Chef,Potato,Pasta,Fruit,Coleslaw,Tabbouleh
Nationalities|French,Greek,Swiss,Dutch,Irish,Danish,Thai,Polish,Spanish,Italian,Turkish,Russian,Belgian,American
Pastries|Danish,Croissant,Eclair,Strudel,Turnover,Scone,Muffin,Baklava,Cannoli,Churro,Donut,Bear Claw,Tart
Chores|Dust,Sweep,Mop,Vacuum,Polish,Iron,Laundry,Dishes,Scrub,Wipe,Fold,Tidy
Toys|Kite,Yo-yo,Doll,Top,Puzzle,Teddy Bear,Blocks,Marbles,Rocking Horse,Robot,Ball,Jigsaw
Keyboard Keys|Shift,Enter,Escape,Tab,Space,Delete,Control,Home,End,Alt,Option,Return,Insert,Caps Lock
`;

/**
 * Common English words a news search would mostly match in their everyday
 * sense rather than as a company name (ADR-010 triage rules). Hand-curated for
 * this project: everyday nouns, verbs and adjectives plus the general words
 * company names are most often borrowed from. Lower case, one per token.
 */
const WORDS = `
a about above accent access account ace act action active actor adapt add address admiral advance advantage
adventure advice affair affinity after again against age agency agent agile aid aim air airline airport alarm
album alert alien align alive all alliance allow ally almost alone along alpha already also alter always amber
amount anchor ancient angel angle animal ankle answer ant anthem any anywhere apart apex appeal apple apply
approach apron arc arch archer area arena argue arm armor army around arrive arrow art article artist ascent ash
ask aspect asset assist atlas atom attack attempt attend attic audience audio aura author auto autumn avenue
avid award aware away axis

baby back backbone backpack bacon badge bag bait bake balance ball balloon bamboo band bank banner bar bare bark
barn barrel base basic basin basket bat batch bath battery battle bay beach beacon beam bean bear beat beauty
become bed bee before begin behind being believe bell belong below belt bench bend benefit berry best better
between beyond bicycle big bike bill bind bird birth bit bite bites bitter black blade blank blast blaze blend
bless blind block bloom blossom blow blue blueprint board boat body bold bolt bond bone bonus book boom boost
boot border born boss both bottle bottom bounce bound bounty bow bowl box boy brain branch brand brave bread break
breath breeze brick bridge brief bright brilliant bring broad broker brook brother brown brush bubble bucket
budget build builder bulb bull bullet bunch burn burst bus bush business busy butter button buy buzz

cabin cable cactus cage cake call calm camera camp campus can canal candle candy cannon canopy canvas canyon cap
capital captain car carbon card care career cargo carpet carrot carry cart case cash cast castle cat catch cause
cave cedar ceiling cell cellar center century chain chair chalk challenge champion chance change channel chapter
charge charm chart chase cheap check cheer cheese chef cherry chess chest chicken chief child chip choice choose
chord circle circuit citizen city civil claim clap class classic clay clean clear clerk clever click client cliff
climb clinch clinic clip clock close cloth cloud clover club clue cluster coach coal coast coat code coffee coin
cold collar collect college colony color column combine come comet comfort command comment common community
company compass compete complete concept concert condition cone confirm connect consider constant contact
content contest context control cook cool copper copy coral cord core corn corner cost cotton couch council count
country couple courage course court cousin cover cow crab craft crane crash crater crawl crayon cream create
credit creek crew cricket crime crisp crop cross crowd crown crucial crush cry crystal cube cue culture cup cure
curious current curve cushion custom customer cut cycle

daily dairy damage dance danger dare dark dash data date dawn day deal dear debate debt decade decide deck deep
deer defense degree delay deliver delta demand den depth desert design desk detail develop device diamond diary
digital dinner direct dirt discover dish distance dive divide dock doctor dog dollar dolphin domain door dose
double dove down draft dragon drama draw dream dress drift drill drink drive drop drum dry duck dune dust duty

each eager eagle early earn earth ease east easy echo eclipse edge edit effect effort egg eight elbow elder
electric element elevate elite else ember emerald empire empty end enemy energy engine enjoy enough enter entire
entry envoy equal equity era escape essence estate even event ever every evidence evolve exact example excel
exchange exit expand expert explore express extra eye

fabric face fact factor factory faith fall false fame family fan fancy farm fashion fast fate father fault favor
feather feature fee feed feel fellow fence fern ferry festival fever few fiber field fierce fig fight figure file
fill film filter final finance find fine finger finish fire firm first fish fit five fix flag flame flash flat
flavor fleet flex flight flint float flock flood floor flour flow flower fluid flute fly focus fog fold folk
follow food foot force forest forge forget fork form fort fortune forum forward fossil found fountain four fox
frame free fresh friend frog front frost fruit fuel full fun fund funnel fur future

gain galaxy game gap garage garden garlic gas gate gather gear gem general genius gentle giant gift ginger give
glad glass glean glide global globe glory glove glow glue go goal goat gold golden good goose grace grade grain
grand grant grape graph grass gravity great green greenlight grid grip ground group grove grow growth guard guess
guest guide guild guitar gulf gun

habit hair half hall hammer hand handle happy harbor hard harmony harvest hat haven hawk head health heart heat
heaven heavy hedge height hello helm help hero hidden high hill hint hire history hit hive hold hole holiday
hollow home honest honey hood hook hope horizon horn horse host hot hotel hour house hub huge human humble hunt
hurry

ice icon idea ideal idle ignite image impact import improve inch include income index indoor industry infant
inner input insight inspire install instance instant interest invest iron island issue item ivory

jacket jade jaguar jam jar jazz jet jewel job join joint joke journal journey joy judge juice jump jungle junior
just

keen keep kernel kettle key kick kid kind king kingdom kit kitchen kite knee knife knight knot know

lab label labor lace ladder lady lake lamp land lane language lantern large laser last late laugh launch
launchpad lava law lawn layer lead leader leaf league lean learn leather leave ledger left leg legacy legend lemon
lemonade lend lens lesson letter level lever liberty library life lift light lime limit line link lion liquid
list listen little live lizard load loan lobby local lock lodge logic long loop lot loud lounge love low loyal
luck lunar lunch

machine magic magnet mail main major make mall mammal man manage manor map maple marble march margin marine mark
market mask mass master match material math matrix matter maze meadow meal measure meat medal media medium meet
melody member memory mentor menu merit mesh message metal method middle might mile milk mill mind mine minute
mirror mission mist mix mobile mode model modern moment money monitor monkey month moon moral morning mosaic moss
mother motion motor mount mountain mouse mouth move movie much mule muse museum music must myth

nail name narrow nation native nature near neat neck need needle nest net network neutral never new news next
nice night noble node noise none noon normal north nose note notice novel now number nurse nut

oak oasis object ocean odd offer office often oil old olive omega one onion only open opera option orange orbit
orchard orchestra order organic origin other otter outdoor outer output outside oval oven over overtime owl own
owner oxygen oyster

pace pack package pad page paint pair palace palm pan panda panel panther paper parade parent park part partner
party pass passage past patch path patient pattern pause peace peach peak pear pearl pebble pen pencil people
pepper perfect period person pet phase phone photo piano pick picture piece pig pigeon pillar pilot pin pine pink
pioneer pipe pivot pixel place plain plan planet plant plate platform play plaza pledge plot plug plum plus
pocket poem poet point polar pole policy polish pond pony pool poor popular port portal position post pot potato
pound powder power practice praise present press pretty price pride prime prince print priority prism private
privateer prize problem process produce product profit program project promise proof proper protect proud prove
public pulse pump punch pupil pure purple purpose push puzzle pyramid

quality quarter queen quest question quick quiet quilt quote

rabbit race rack radar radio rail rain rainbow raise rally ranch range rapid rare rate raven raw ray reach read
ready real realm reason rebel record recycle red reef refine reform region relay relief remedy remote render
rent repair report rescue reserve resolve resource rest result retail return reveal review reward rewire rhythm
ribbon rice rich ride ridge rifle right ring ripple rise risk ritual rival river road roast robin robot rock
rocket role roll roof room root rope rose rough round route row royal rubber rug rule run rush

saddle safe sage sail salad salmon salt same sand satellite sauce save scale scan scene school science scope
score scout screen script sea seal search season seat second secret section secure seed seek select sell send
sense sentinel series serve service session settle seven shade shadow shape share shark sharp shelf shell
shelter shield shift shine ship shirt shock shoe shop shore short shot shoulder show shuttle side sight sign
signal silent silk silo silver simple single sister site six size sketch skill skin sky slate sleep slice slide
slim slope small smart smile smoke smooth snack snake snap snow soap soccer social sock soft soil solar soldier
solid solo solution solve song sonic soul sound source south space spark speak special speed spell spend sphere
spice spider spin spirit split spoon sport spot spray spring spruce square squad stable stack stadium staff
stage stair stamp stand star start state station status stay steady steam steel stem step stick still stock
stone stop store storm story stove straight strand strategy straw stream street strength stretch stride strike
string stripe strong student studio style subject submit success sugar suit summer summit sun sunny sunrise
sunset super supply support supreme sure surf surface surge swan sweet swift swim swing switch sword symbol
system

table tactic tail talent talk tall tank tap target task taste tax tea teach team tell temple ten tenant tender
tent term test text theater theme theory thing think third thread three thrive thunder ticket tide tiger tile
timber time tiny tip title toast today token tomato tone tool tooth top topic torch total touch tough tour tower
town toy trace track trade trail train trait transfer travel treasure treat tree trend trial tribe trick trigger
trip trophy true trunk trust truth try tube tulip tune tunnel turn turtle twin twist type

ultra umbrella uncle under union unique unit unity universe up update upper urban use useful usual

vacation valley value van vapor vault vector velvet venture verse vertex vessel veteran view village vine
violet virtue vision visit vista visual vital vivid voice volt volume vote voyage

wagon wait walk wall wallet wander want war warm warrior wash watch water wave way wealth weather web wedge week
weight welcome well west wet whale wheat wheel while whisper white whole wide wild will willow win wind window
wine wing winner winter wire wisdom wise wish wit wolf wonder wood word work world worth wrap write

yacht yard year yellow yes yield young youth

zeal zebra zen zero zest zone zoom
`;

export const COMMON_ENGLISH_WORDS: ReadonlySet<string> = new Set(WORDS.split(/\s+/).filter((word) => word !== ''));

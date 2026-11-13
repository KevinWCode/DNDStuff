/* ---------- static rules data (SRD 5.1 / 5.2.1, CC-BY-4.0) ---------- */
const ABIL = ['str','dex','con','int','wis','cha'];
const ABN = {str:'Strength',dex:'Dexterity',con:'Constitution',int:'Intelligence',wis:'Wisdom',cha:'Charisma'};
const SKILLS = [
  ['acrobatics','dex','Acrobatics'],['animal','wis','Animal Handling'],['arcana','int','Arcana'],['athletics','str','Athletics'],
  ['deception','cha','Deception'],['history','int','History'],['insight','wis','Insight'],['intimidation','cha','Intimidation'],
  ['investigation','int','Investigation'],['medicine','wis','Medicine'],['nature','int','Nature'],['perception','wis','Perception'],
  ['performance','cha','Performance'],['persuasion','cha','Persuasion'],['religion','int','Religion'],['sleight','dex','Sleight of Hand'],
  ['stealth','dex','Stealth'],['survival','wis','Survival']];
const CONDITIONS = ['Blinded','Charmed','Deafened','Frightened','Grappled','Incapacitated','Invisible','Paralyzed','Petrified','Poisoned','Prone','Restrained','Stunned','Unconscious'];
const LANES = [['action','Action'],['bonus','Bonus Action'],['reaction','Reaction'],['free','Free / Special']];
const STD_ACTIONS = {
  action:[['Dash','Extra move equal to your Speed'],['Disengage','No opportunity attacks this turn'],['Dodge','Attacks vs you have disadvantage'],['Help','Give an ally advantage'],['Hide','Dexterity (Stealth) check'],['Ready','Set a trigger, use your reaction'],['Search','Wisdom check to find something'],['Use an Object','Interact with a second object'],['Study','Intelligence check (2024)'],['Influence','Charisma/Wisdom check (2024)'],['Grapple / Shove','Unarmed Strike option']],
  bonus:[['Two-Weapon Attack','Light weapon in the other hand']],
  reaction:[['Opportunity Attack','Creature leaves your reach'],['Readied Action','Your Ready trigger fires']],
  free:[['Interact','Draw a weapon, open a door'],['Speak','A few words'],['Drop Prone','Costs no movement']]
};
/* Buff definitions. Numbers add; strings are dice added to the roll. */
const BUFFS = {
  bless:{label:'Bless',desc:'+1d4 to attack rolls and saving throws',atk:'1d4',save:'1d4',conc:true},
  rage:{label:'Rage',desc:'+2 melee STR damage, resist B/P/S, adv. STR checks & saves',dmgMelee:2,resistBPS:true},
  reckless:{label:'Reckless',desc:'Advantage on STR melee attacks; attacks vs you have advantage',note:'ADV'},
  gwm:{label:'Great Weapon Master',desc:'2014: -5 hit / +10 dmg. 2024: +PB dmg with Heavy weapons',heavy:true},
  sharp:{label:'Sharpshooter',desc:'2014: -5 hit / +10 dmg with ranged. 2024: ignore cover',ranged:true},
  sneak:{label:'Sneak Attack',desc:'Extra damage once per turn (finesse or ranged)',sneak:true},
  hex:{label:'Hex',desc:'+1d6 necrotic on hits vs the hexed target',dmgDice:'1d6'},
  cover2:{label:'Half Cover',desc:'+2 AC and DEX saves',ac:2,group:'cover'},
  cover5:{label:'¾ Cover',desc:'+5 AC and DEX saves',ac:5,group:'cover'},
  shield:{label:'Shield (spell)',desc:'+5 AC until your next turn',ac:5},
  haste:{label:'Haste',desc:'+2 AC, doubled speed, one extra limited action',ac:2,speedX:2,extraAction:true,conc:true},
  dodge:{label:'Dodging',desc:'Attacks vs you have disadvantage'}
};
/* ---------- sample characters (example data; replace with your own) ---------- */
function sampleAshka(){ return {
  id:'ashka', name:'Ashka Emberveil', species:'Tiefling', classes:[{name:'Warlock',sub:'Fiend Patron',lvl:5,hd:8}],
  ruleset:'2024', skin:'ember', portrait:'A',
  abilities:{str:8,dex:14,con:14,int:10,wis:12,cha:18},
  saves:['wis','cha'], skills:{arcana:1,history:1,deception:1,intimidation:1},
  ac:{type:'armor',name:'Mage Armor (Armor of Shadows)',base:13,dexCap:99,misc:0},
  speed:30, initMisc:0, hp:{cur:38,max:38,temp:0}, death:{s:0,f:0}, conc:null, exhaustion:0, conditions:[],
  hitDice:[{cls:'Warlock',die:8,max:5,used:0}],
  casting:{ability:'cha'},
  slots:[{lvl:3,max:2,used:0,label:'Pact',rest:'short'}],
  spells:[
    {id:'s1',name:'Eldritch Blast',lvl:0,school:'Evocation',time:'action',range:'120 ft',area:'',conc:false,ritual:false,comp:'V, S',dur:'Instant',desc:'Two beams at level 5. Each: ranged spell attack {{atk}}, 1d10 + {{mod}} force (Agonizing Blast). Repelling Blast can push 10 ft.'},
    {id:'s2',name:'Minor Illusion',lvl:0,school:'Illusion',time:'action',range:'30 ft',area:'cube',conc:false,ritual:false,comp:'S, M',dur:'1 minute',desc:'Create a sound or an image of an object no larger than a 5-ft cube. Investigation vs DC {{dc}} reveals it.'},
    {id:'s3',name:'Prestidigitation',lvl:0,school:'Transmutation',time:'action',range:'10 ft',area:'',conc:false,ritual:false,comp:'V, S',dur:'Up to 1 hour',desc:'Minor magical tricks: light a candle, clean, chill, flavor, mark a symbol.'},
    {id:'s4',name:'Hex',lvl:1,school:'Enchantment',time:'bonus',range:'90 ft',area:'',conc:true,ritual:false,comp:'V, S, M',dur:'Up to 1 hour',buff:'hex',desc:'Curse a creature: +1d6 necrotic when you hit it, and disadvantage on checks with one ability you choose. Move the curse with a Bonus Action if the target drops to 0 HP.'},
    {id:'s5',name:'Armor of Agathys',lvl:1,school:'Abjuration',time:'bonus',range:'Self',area:'',conc:false,ritual:false,comp:'V, S, M',dur:'1 hour',temp:'5*SL',desc:'Gain 5 Temporary HP per slot level. A creature that hits you in melee takes 5 cold damage per slot level while the Temp HP lasts.'},
    {id:'s6',name:'Hellish Rebuke',lvl:1,school:'Evocation',time:'reaction',range:'60 ft',area:'',conc:false,ritual:false,comp:'V, S',dur:'Instant',desc:'When damaged by a creature you can see: DEX save DC {{dc}}, 2d10 fire (+1d10 per slot level above 1st), half on success.'},
    {id:'s7',name:'Misty Step',lvl:2,school:'Conjuration',time:'bonus',range:'Self',area:'',conc:false,ritual:false,comp:'V',dur:'Instant',desc:'Teleport up to 30 feet to an unoccupied space you can see.'},
    {id:'s8',name:'Hold Person',lvl:2,school:'Enchantment',time:'action',range:'60 ft',area:'',conc:true,ritual:false,comp:'V, S, M',dur:'Up to 1 minute',desc:'A Humanoid makes a WIS save DC {{dc}} or is Paralyzed. It repeats the save at the end of each of its turns. One extra target per slot level above 2nd.'},
    {id:'s9',name:'Counterspell',lvl:3,school:'Abjuration',time:'reaction',range:'60 ft',area:'',conc:false,ritual:false,comp:'S',dur:'Instant',desc:'Interrupt a creature casting a spell. It makes a CON save DC {{dc}}; on a failure the spell dissipates and the slot is not spent (2024).'},
    {id:'s10',name:'Hunger of Hadar',lvl:3,school:'Conjuration',time:'action',range:'150 ft',area:'sphere',conc:true,ritual:false,comp:'V, S, M',dur:'Up to 1 minute',desc:'A 20-ft-radius sphere of darkness and cold. 2d6 cold at the start of a creature\'s turn inside; DEX save DC {{dc}} at the end of its turn or 2d6 acid.'},
    {id:'s11',name:'Detect Magic',lvl:1,school:'Divination',time:'action',range:'Self',area:'sphere',conc:true,ritual:true,comp:'V, S',dur:'Up to 10 minutes',desc:'Sense magic within 30 feet. Cast as a ritual with Pact of the Tome or the Book of Shadows.'}
  ],
  attacks:[
    {id:'a1',name:'Dagger',ability:'finesse',prof:true,magic:0,dmg:'1d4',type:'piercing',props:'Finesse, Light, Thrown 20/60',mastery:'Nick',melee:true,ranged:false,heavy:false},
    {id:'a2',name:'Eldritch Blast (beam)',ability:'cha',prof:true,magic:0,dmg:'1d10',type:'force',props:'Spell attack, 120 ft, ×2 beams',melee:false,ranged:true,heavy:false,spellAtk:true,addMod:true}
  ],
  sets:[{name:'Dagger & Focus',attacks:['a1','a2'],shield:false}], activeSet:0,
  features:[
    {id:'f1',name:"Dark One's Blessing",time:'free',desc:'When you reduce a hostile creature to 0 HP, gain CHA mod + Warlock level Temporary HP.',temp:'CHA+LVL'},
    {id:'f2',name:'Magical Cunning',time:'free',desc:'1-minute rite: regain half your Pact slots (round up). Once per Long Rest.',res:'r2'},
    {id:'f3',name:'Imp familiar commands',time:'bonus',desc:'Pact of the Chain: command your familiar; it can deliver touch spells.'},
    {id:'f4',name:'Fiendish Resilience prep',time:'free',desc:'(Level 10) Not yet. Note for the future.'}
  ],
  buffs:['bless','cover2','cover5','hex','haste','dodge'], active:{},
  resources:[
    {id:'r1',name:'Wand of Web',max:7,cur:7,rest:'dawn',regain:'1d6+1',note:'Spend 1 charge: cast Web (DC 15)'},
    {id:'r2',name:'Magical Cunning',max:1,cur:1,rest:'long'},
    {id:'r3',name:'Heroic Inspiration',max:1,cur:1,rest:'long',note:'Reroll any die'}
  ],
  summons:[{id:'m1',name:'Imp (familiar)',hp:21,max:21,ac:13,note:'Invisible at will, Sting +5, 1d6+3 piercing + 2d6 poison',absorb:false}],
  items:[
    {id:'i1',name:'Cloak of Protection',qty:1,attune:true,attuned:true,equipped:true,ac:1,saves:1,desc:'+1 to AC and saving throws.'},
    {id:'i2',name:'Wand of Web',qty:1,attune:true,attuned:true,equipped:true,desc:'7 charges. Regains 1d6+1 daily at dawn.'},
    {id:'i3',name:'Arcane Focus (rod)',qty:1,equipped:true},
    {id:'i4',name:'Dagger',qty:2,equipped:true},
    {id:'i5',name:'Potion of Healing',qty:2,desc:'2d4 + 2 HP'},
    {id:'i6',name:"Explorer's Pack",qty:1}
  ],
  coins:{cp:12,sp:40,ep:0,gp:156,pp:2},
  overrides:{}, turn:{action:0,bonus:0,reaction:0,extra:0,move:0,round:1,dash:false},
  notes:'Grew up in the ash-quarter of Vellmark. Made the pact to save her brother Tavi; the Fiend calls it a loan.\n\nAllies: Brother Orin (temple), Mira Quickfingers (fence).\nOwes: one favor to the Fiend, terms unknown.',
  ink:[[]], log:[]
};}
function sampleBrakka(){ return {
  id:'brakka', name:'Brakka Stonejaw', species:'Orc', classes:[{name:'Barbarian',sub:'Path of the Berserker',lvl:3,hd:12},{name:'Fighter',sub:'',lvl:2,hd:10}],
  ruleset:'2024', skin:'steel', portrait:'B',
  abilities:{str:17,dex:14,con:16,int:8,wis:12,cha:10},
  saves:['str','con'], skills:{athletics:1,intimidation:1,perception:1,survival:1},
  ac:{type:'unarmored',name:'Unarmored Defense',base:10,dexCap:99,misc:0,adds:['con']},
  speed:40, initMisc:0, hp:{cur:53,max:53,temp:0}, death:{s:0,f:0}, conc:null, exhaustion:0, conditions:[],
  hitDice:[{cls:'Barbarian',die:12,max:3,used:0},{cls:'Fighter',die:10,max:2,used:0}],
  casting:null, slots:[], spells:[],
  attacks:[
    {id:'a1',name:'Greataxe',ability:'str',prof:true,magic:0,dmg:'1d12',type:'slashing',props:'Heavy, Two-Handed',mastery:'Cleave',melee:true,heavy:true},
    {id:'a2',name:'Handaxe',ability:'str',prof:true,magic:0,dmg:'1d6',type:'slashing',props:'Light, Thrown 20/60',mastery:'Vex',melee:true},
    {id:'a3',name:'Javelin (thrown)',ability:'str',prof:true,magic:0,dmg:'1d6',type:'piercing',props:'Thrown 30/120',mastery:'Slow',melee:false,ranged:true}
  ],
  sets:[{name:'Greataxe',attacks:['a1','a3'],shield:false},{name:'Handaxe & Shield',attacks:['a2','a3'],shield:true}], activeSet:0,
  features:[
    {id:'f1',name:'Rage',time:'bonus',desc:'+2 damage with STR attacks, resistance to B/P/S, advantage on STR checks and saves. Lasts 10 minutes (2024).',buff:'rage',res:'r1'},
    {id:'f2',name:'Second Wind',time:'bonus',desc:'Regain 1d10 + Fighter level HP.',res:'r2',heal:'1d10+2'},
    {id:'f3',name:'Action Surge',time:'free',desc:'Take one additional action this turn.',res:'r3',extraAction:true},
    {id:'f4',name:'Reckless Attack',time:'free',desc:'Advantage on STR melee attacks this turn; attacks against you have advantage.',buff:'reckless'},
    {id:'f5',name:'Frenzy',time:'free',desc:'While raging and attacking recklessly, the first STR hit each turn deals extra damage: d6 × Rage Damage bonus.'},
    {id:'f6',name:'Relentless Endurance',time:'reaction',desc:'Orc trait: drop to 1 HP instead of 0 once per Long Rest.',res:'r4'},
    {id:'f7',name:'Adrenaline Rush',time:'bonus',desc:'Orc trait: Dash as a Bonus Action and gain Temp HP equal to your Proficiency Bonus.',temp:'PB'}
  ],
  buffs:['rage','reckless','gwm','bless','cover2','cover5','dodge'], active:{},
  resources:[
    {id:'r1',name:'Rage',max:3,cur:3,rest:'long',note:'Regain 1 on a Short Rest (2024)',shortRegain:1},
    {id:'r2',name:'Second Wind',max:2,cur:2,rest:'long',note:'Regain 1 on a Short Rest',shortRegain:1},
    {id:'r3',name:'Action Surge',max:1,cur:1,rest:'short'},
    {id:'r4',name:'Relentless Endurance',max:1,cur:1,rest:'long'},
    {id:'r5',name:'Adrenaline Rush',max:3,cur:3,rest:'short',note:'Uses = Proficiency Bonus'}
  ],
  summons:[],
  items:[
    {id:'i1',name:'Greataxe',qty:1,equipped:true},{id:'i2',name:'Handaxe',qty:2,equipped:true},{id:'i3',name:'Shield',qty:1,equipped:true,desc:'+2 AC when held (Weapon Set B)'},
    {id:'i4',name:'Javelin',qty:4,equipped:true},{id:'i5',name:'Potion of Healing',qty:3,desc:'2d4 + 2 HP'},{id:'i6',name:'Wolf-pelt cloak',qty:1}
  ],
  coins:{cp:30,sp:22,ep:0,gp:48,pp:0},
  overrides:{}, turn:{action:0,bonus:0,reaction:0,extra:0,move:0,round:1,dash:false},
  notes:'Pit fighter from the Saltmarsh arena. Fights for coin, stays for the party.',
  feats:['Great Weapon Master'], ink:[[]], log:[]
};}
function blankChar(){ const c = sampleBrakka(); return Object.assign(c,{
  id:'c'+Date.now().toString(36), name:'New Hero', species:'', classes:[{name:'Fighter',sub:'',lvl:1,hd:10}], skin:'radiant', portrait:'N',
  abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10}, saves:[], skills:{}, ac:{type:'armor',name:'Unarmored',base:10,dexCap:99,misc:0},
  speed:30, hp:{cur:10,max:10,temp:0}, hitDice:[{cls:'Fighter',die:10,max:1,used:0}], attacks:[], sets:[{name:'Main',attacks:[],shield:false}],
  features:[], buffs:['bless','cover2','cover5','dodge'], resources:[], summons:[], items:[], coins:{cp:0,sp:0,ep:0,gp:10,pp:0},
  notes:'', feats:[], log:[] }); }

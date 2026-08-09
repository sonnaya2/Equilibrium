import type { CombatDataset, TargetPresetRecord } from "./records";

/**
 * Target preset dataset for the combat catalogue.
 * Sourced from RuneScape Wiki Bucket infobox_monster (2026-08-09).
 * Offline rebuild does not fetch Wiki; this module is the shipped dataset.
 */
export const combatTargetPresetsData: CombatDataset<TargetPresetRecord> = {
  lastSynced: "2026-08-09",
  trackedSince: "2024-03-04",
  records: [
  {
    "id": "boss:giant-mole",
    "name": "Giant Mole",
    "encounter": "General",
    "aliases": [
      "Mole"
    ],
    "category": "boss",
    "wiki": {
      "pageName": "Giant Mole",
      "pageNameSub": "Giant mole#Normal",
      "versionAnchor": "Normal",
      "npcIds": [
        18932
      ]
    },
    "support": "supported",
    "sources": [
      {
        "source": "runescape-wiki",
        "url": "https://runescape.wiki/w/Giant_Mole",
        "title": "Giant Mole",
        "verifiedAt": "2026-08-09"
      }
    ],
    "stats": {
      "defenceLevel": 45,
      "armour": 732,
      "affinities": {
        "melee": 55,
        "ranged": 45,
        "magic": 65
      },
      "weaknessClass": "magic",
      "size": null,
      "lifePoints": 78000,
      "poisonImmune": false
    }
  },
  {
    "id": "boss:king-black-dragon",
    "name": "King Black Dragon",
    "encounter": "General",
    "aliases": [
      "KBD"
    ],
    "category": "boss",
    "wiki": {
      "pageName": "King Black Dragon",
      "pageNameSub": "King Black Dragon",
      "npcIds": [
        50
      ]
    },
    "support": "supported",
    "sources": [
      {
        "source": "runescape-wiki",
        "url": "https://runescape.wiki/w/King_Black_Dragon",
        "title": "King Black Dragon",
        "verifiedAt": "2026-08-09"
      }
    ],
    "stats": {
      "defenceLevel": 60,
      "armour": 1132,
      "affinities": {
        "melee": 60,
        "ranged": 50,
        "magic": 70
      },
      "weaknessClass": "magic",
      "size": 5,
      "lifePoints": 45000,
      "poisonImmune": false
    }
  },
  {
    "id": "boss:queen-black-dragon",
    "name": "Queen Black Dragon",
    "encounter": "General",
    "aliases": [
      "QBD"
    ],
    "category": "boss",
    "wiki": {
      "pageName": "Queen Black Dragon",
      "pageNameSub": "Queen Black Dragon#Crystal",
      "versionAnchor": "Crystal",
      "npcIds": [
        15506
      ]
    },
    "support": "supported",
    "sources": [
      {
        "source": "runescape-wiki",
        "url": "https://runescape.wiki/w/Queen_Black_Dragon",
        "title": "Queen Black Dragon",
        "verifiedAt": "2026-08-09"
      }
    ],
    "stats": {
      "defenceLevel": 80,
      "armour": 1924,
      "affinities": {
        "melee": 70,
        "ranged": 70,
        "magic": 40,
        "weakness": 40
      },
      "size": 5,
      "lifePoints": 100000,
      "poisonImmune": true
    }
  },
  {
    "id": "boss:general-graardor",
    "name": "General Graardor",
    "encounter": "God Wars Dungeon",
    "aliases": [
      "Bandos",
      "Graardor"
    ],
    "category": "boss",
    "wiki": {
      "pageName": "General Graardor",
      "pageNameSub": "General Graardor#Normal",
      "versionAnchor": "Normal",
      "npcIds": [
        6260
      ]
    },
    "support": "supported",
    "sources": [
      {
        "source": "runescape-wiki",
        "url": "https://runescape.wiki/w/General_Graardor",
        "title": "General Graardor",
        "verifiedAt": "2026-08-09"
      }
    ],
    "stats": {
      "defenceLevel": 60,
      "armour": 1132,
      "affinities": {
        "melee": 50,
        "ranged": 10,
        "magic": 50
      },
      "size": 3,
      "lifePoints": 40000,
      "poisonImmune": true
    }
  },
  {
    "id": "boss:kreearra",
    "name": "Kree'arra",
    "encounter": "God Wars Dungeon",
    "aliases": [
      "Kree",
      "Armadyl"
    ],
    "category": "boss",
    "wiki": {
      "pageName": "Kree'arra",
      "pageNameSub": "Kree'arra#The World Wakes",
      "versionAnchor": "The World Wakes",
      "npcIds": [
        16924
      ]
    },
    "support": "supported",
    "sources": [
      {
        "source": "runescape-wiki",
        "url": "https://runescape.wiki/w/Kree'arra",
        "title": "Kree'arra",
        "verifiedAt": "2026-08-09"
      }
    ],
    "stats": {
      "defenceLevel": 70,
      "armour": 1486,
      "affinities": {
        "melee": 50,
        "ranged": 40,
        "magic": 30
      },
      "weaknessClass": "melee",
      "size": null,
      "lifePoints": 40000,
      "poisonImmune": true
    }
  },
  {
    "id": "boss:commander-zilyana",
    "name": "Commander Zilyana",
    "encounter": "God Wars Dungeon",
    "aliases": [
      "Zilyana",
      "Sara"
    ],
    "category": "boss",
    "wiki": {
      "pageName": "Commander Zilyana",
      "pageNameSub": "Commander Zilyana#Hard mode",
      "versionAnchor": "Hard mode",
      "npcIds": [
        17084
      ]
    },
    "support": "supported",
    "sources": [
      {
        "source": "runescape-wiki",
        "url": "https://runescape.wiki/w/Commander_Zilyana",
        "title": "Commander Zilyana",
        "verifiedAt": "2026-08-09"
      }
    ],
    "stats": {
      "defenceLevel": 75,
      "armour": 1694,
      "affinities": {
        "melee": 45,
        "ranged": 40,
        "magic": 50
      },
      "weaknessClass": "magic",
      "size": null,
      "lifePoints": 100000,
      "poisonImmune": true
    }
  },
  {
    "id": "boss:kril-tsutsaroth",
    "name": "K'ril Tsutsaroth",
    "encounter": "God Wars Dungeon",
    "aliases": [
      "K'ril",
      "Kril",
      "Zammy"
    ],
    "category": "boss",
    "wiki": {
      "pageName": "K'ril Tsutsaroth",
      "pageNameSub": "K'ril Tsutsaroth#Normal",
      "versionAnchor": "Normal",
      "npcIds": [
        6203
      ]
    },
    "support": "supported",
    "sources": [
      {
        "source": "runescape-wiki",
        "url": "https://runescape.wiki/w/K'ril_Tsutsaroth",
        "title": "K'ril Tsutsaroth",
        "verifiedAt": "2026-08-09"
      }
    ],
    "stats": {
      "defenceLevel": 60,
      "armour": 1132,
      "affinities": {
        "melee": 45,
        "ranged": 40,
        "magic": 50,
        "weakness": 75
      },
      "weaknessClass": "magic",
      "size": 5,
      "lifePoints": 55000,
      "poisonImmune": true
    }
  },
  {
    "id": "boss:nex",
    "name": "Nex",
    "encounter": "God Wars Dungeon",
    "aliases": [
      "Nex"
    ],
    "category": "boss",
    "wiki": {
      "pageName": "Nex",
      "pageNameSub": "Nex#Deflecting melee",
      "versionAnchor": "Deflecting melee",
      "npcIds": [
        13449
      ]
    },
    "support": "supported",
    "sources": [
      {
        "source": "runescape-wiki",
        "url": "https://runescape.wiki/w/Nex",
        "title": "Nex",
        "verifiedAt": "2026-08-09"
      }
    ],
    "stats": {
      "defenceLevel": 80,
      "armour": 1924,
      "affinities": {
        "melee": 40,
        "ranged": 40,
        "magic": 40
      },
      "size": null,
      "lifePoints": 200000,
      "poisonImmune": true
    }
  },
  {
    "id": "boss:araxxor",
    "name": "Araxxor",
    "encounter": "Araxxi",
    "aliases": [
      "Rax",
      "Araxxor"
    ],
    "category": "boss",
    "wiki": {
      "pageName": "Araxxor",
      "pageNameSub": "Araxxor#Ranged",
      "versionAnchor": "Ranged",
      "npcIds": [
        19463
      ]
    },
    "support": "supported",
    "sources": [
      {
        "source": "runescape-wiki",
        "url": "https://runescape.wiki/w/Araxxor",
        "title": "Araxxor",
        "verifiedAt": "2026-08-09"
      }
    ],
    "stats": {
      "defenceLevel": 85,
      "armour": 1924,
      "affinities": {
        "melee": 60,
        "ranged": 45,
        "magic": 40
      },
      "weaknessClass": "melee",
      "size": 5,
      "lifePoints": 100000,
      "poisonImmune": true
    }
  },
  {
    "id": "boss:araxxi",
    "name": "Araxxi",
    "encounter": "Araxxi",
    "aliases": [
      "Araxxi"
    ],
    "category": "boss",
    "wiki": {
      "pageName": "Araxxi",
      "pageNameSub": "Araxxi",
      "npcIds": [
        19464
      ]
    },
    "support": "supported",
    "sources": [
      {
        "source": "runescape-wiki",
        "url": "https://runescape.wiki/w/Araxxi",
        "title": "Araxxi",
        "verifiedAt": "2026-08-09"
      }
    ],
    "stats": {
      "defenceLevel": 80,
      "armour": 1924,
      "affinities": {
        "melee": 60,
        "ranged": 60,
        "magic": 60
      },
      "size": null,
      "lifePoints": 100000,
      "poisonImmune": true
    }
  },
  {
    "id": "boss:tzkal-zuk",
    "name": "TzKal-Zuk",
    "encounter": "TzekHaar",
    "aliases": [
      "Zuk"
    ],
    "category": "boss",
    "wiki": {
      "pageName": "TzKal-Zuk",
      "pageNameSub": "TzKal-Zuk#Hard Mode",
      "versionAnchor": "Hard Mode",
      "npcIds": [
        28527
      ]
    },
    "support": "supported",
    "sources": [
      {
        "source": "runescape-wiki",
        "url": "https://runescape.wiki/w/TzKal-Zuk",
        "title": "TzKal-Zuk",
        "verifiedAt": "2026-08-09"
      }
    ],
    "stats": {
      "defenceLevel": 80,
      "armour": 1924,
      "affinities": {
        "melee": 55,
        "ranged": 55,
        "magic": 65
      },
      "weaknessClass": "magic",
      "size": 5,
      "lifePoints": 1200000,
      "poisonImmune": true
    }
  },
  {
    "id": "boss:arch-glacor",
    "name": "Arch-Glacor",
    "encounter": "Elder God Wars",
    "aliases": [
      "Glacor",
      "AG"
    ],
    "category": "boss",
    "wiki": {
      "pageName": "Arch-Glacor",
      "pageNameSub": "Arch-Glacor#Hard mode",
      "versionAnchor": "Hard mode",
      "npcIds": [
        28241
      ]
    },
    "support": "supported",
    "sources": [
      {
        "source": "runescape-wiki",
        "url": "https://runescape.wiki/w/Arch-Glacor",
        "title": "Arch-Glacor",
        "verifiedAt": "2026-08-09"
      }
    ],
    "stats": {
      "defenceLevel": 75,
      "armour": 1694,
      "affinities": {
        "melee": 55,
        "ranged": 55,
        "magic": 55
      },
      "size": 8,
      "lifePoints": 370000,
      "poisonImmune": false
    }
  },
  {
    "id": "boss:rasial",
    "name": "Rasial, the First Necromancer",
    "encounter": "General",
    "aliases": [
      "Rasial"
    ],
    "category": "boss",
    "wiki": {
      "pageName": "Rasial, the First Necromancer",
      "pageNameSub": "Rasial, the First Necromancer#Normal",
      "versionAnchor": "Normal",
      "npcIds": [
        30165
      ]
    },
    "support": "supported",
    "sources": [
      {
        "source": "runescape-wiki",
        "url": "https://runescape.wiki/w/Rasial%2C_the_First_Necromancer",
        "title": "Rasial, the First Necromancer",
        "verifiedAt": "2026-08-09"
      }
    ],
    "stats": {
      "defenceLevel": 95,
      "armour": 2458,
      "affinities": {
        "melee": 55,
        "ranged": 55,
        "magic": 55,
        "weakness": 55
      },
      "size": null,
      "lifePoints": 800000,
      "poisonImmune": true
    }
  },
  {
    "id": "boss:amascut",
    "name": "Amascut, the Devourer",
    "encounter": "General",
    "aliases": [
      "Amascut",
      "Devourer"
    ],
    "category": "boss",
    "wiki": {
      "pageName": "Amascut, the Devourer",
      "pageNameSub": "Amascut, the Devourer#Eclipse of the Heart",
      "versionAnchor": "Eclipse of the Heart",
      "npcIds": [
        32060
      ]
    },
    "support": "supported",
    "sources": [
      {
        "source": "runescape-wiki",
        "url": "https://runescape.wiki/w/Amascut%2C_the_Devourer",
        "title": "Amascut, the Devourer",
        "verifiedAt": "2026-08-09"
      }
    ],
    "stats": {
      "defenceLevel": 90,
      "armour": 2458,
      "affinities": {
        "melee": 55,
        "ranged": 55,
        "magic": 55
      },
      "size": 3,
      "lifePoints": 800000,
      "poisonImmune": true
    }
  },
  {
    "id": "boss:telos",
    "name": "Telos, the Warden",
    "encounter": "General",
    "aliases": [
      "Telos"
    ],
    "category": "boss",
    "wiki": {
      "pageName": "Telos, the Warden",
      "pageNameSub": "Telos, the Warden#Dormant",
      "versionAnchor": "Dormant",
      "npcIds": [
        22892
      ]
    },
    "support": "provisional",
    "sources": [
      {
        "source": "runescape-wiki",
        "url": "https://runescape.wiki/w/Telos%2C_the_Warden",
        "title": "Telos, the Warden",
        "verifiedAt": "2026-08-09"
      }
    ],
    "stats": {
      "defenceLevel": 80,
      "armour": null,
      "affinities": null,
      "size": 5,
      "lifePoints": 0,
      "poisonImmune": true
    }
  },
  ],
};

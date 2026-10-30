import { eventBus } from '../utils/EventBus';
import { EVENTS } from '../utils/Constants';
import { EconomySystem } from '../economy/EconomySystem';
import { SoundManager } from '../audio/SoundManager';

export interface StoryChapter {
  id: number;
  title: string;
  speaker: string;
  avatar: string;
  dialogue: string;
  objective: string;
  reward: number;
  isCompleted: boolean;
}

export class StorySystem {
  public currentChapterIndex: number = 0;
  public chapters: StoryChapter[] = [
    {
      id: 1,
      title: 'Kapitel 1: Willkommen im Neon-Dschungel',
      speaker: 'Matti',
      avatar: '🧢',
      dialogue:
        "Ey Kumpel, willkommen in Los Cyberos! Lass uns zuerst zur grünen Pay 'n' Spray Werkstatt fahren und unseren ersten Schlitten aufmotzen!",
      objective: "Fahre zur Pay 'n' Spray Werkstatt und rüste ein Tuning-Upgrade aus.",
      reward: 1000,
      isCompleted: false,
    },
    {
      id: 2,
      title: 'Kapitel 2: Das Straßenrennen',
      speaker: 'Kumpel',
      avatar: '🎮',
      dialogue:
        'Die Cyber Vipers fordern uns heraus! Am Startbogen drüben wartet ein Straßenrennen. Zeigen wir denen, wer der König der Straße ist!',
      objective:
        'Starte das Checkpoint-Rennen am leuchtenden Torbogen und schlage Cyber Viper & Neon Phantom!',
      reward: 2000,
      isCompleted: false,
    },
    {
      id: 3,
      title: 'Kapitel 3: Über den Dächern von Downtown',
      speaker: 'Matti',
      avatar: '🧢',
      dialogue:
        'Hast du das Dach des höchsten Wolkenkratzers gesehen? Da oben steht ein fliegbarer Helikopter! Zeit abzuheben!',
      objective: 'Erklimme das Helipad oder aktiviere den DeLorean Flugmodus (`V`).',
      reward: 3000,
      isCompleted: false,
    },
    {
      id: 4,
      title: 'Kapitel 4: Der Große Bankraub',
      speaker: 'Kumpel',
      avatar: '🎮',
      dialogue:
        'Wir brauchen das ganz große Geld! Die Bank von Los Cyberos hat $25.000 im Tresor. Lass uns C4 besorgen und die Tür aufsprengen!',
      objective: 'Betritt die Bank of Los Cyberos und sprenge den Tresorraum auf.',
      reward: 5000,
      isCompleted: false,
    },
    {
      id: 5,
      title: 'Kapitel 5: Die Herrscher von Los Cyberos',
      speaker: 'Matti & Kumpel',
      avatar: '👑',
      dialogue:
        'Nur noch ein Ziel: Der schwer bewaffnete Kopfgeld-Konvoi-Boss auf dem Außenring! Schnapp dir den Rhino-Panzer oder den Raketenwerfer!',
      objective: 'Zerstöre das 300 HP Kopfgeld-Ziel auf dem Stadtring und werde zur Legende!',
      reward: 10000,
      isCompleted: false,
    },
  ];

  private economy: EconomySystem;
  private sound: SoundManager;

  constructor(economy: EconomySystem, sound: SoundManager) {
    this.economy = economy;
    this.sound = sound;

    this.loadFromLocalStorage();

    // Announce first chapter on start
    setTimeout(() => {
      this.announceCurrentChapter();
    }, 1500);
  }

  public saveToLocalStorage(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(
        'gta7_story_chapter',
        JSON.stringify({
          currentChapterIndex: this.currentChapterIndex,
          chapters: this.chapters.map((c) => ({ id: c.id, isCompleted: c.isCompleted })),
        }),
      );
    } catch {
      // ignore
    }
  }

  public loadFromLocalStorage(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const data = localStorage.getItem('gta7_story_chapter');
      if (data) {
        const parsed = JSON.parse(data);
        if (typeof parsed.currentChapterIndex === 'number') {
          this.currentChapterIndex = Math.min(
            this.chapters.length - 1,
            Math.max(0, parsed.currentChapterIndex),
          );
        }
        if (Array.isArray(parsed.chapters)) {
          parsed.chapters.forEach((saved: { id: number; isCompleted: boolean }) => {
            const ch = this.chapters.find((c) => c.id === saved.id);
            if (ch) ch.isCompleted = saved.isCompleted;
          });
        }
      }
    } catch {
      // ignore
    }
  }

  public getCurrentChapter(): StoryChapter {
    return this.chapters[this.currentChapterIndex] || this.chapters[this.chapters.length - 1];
  }

  public advanceChapter(): boolean {
    const ch = this.getCurrentChapter();
    if (ch.isCompleted) return false;

    ch.isCompleted = true;
    this.economy.addCash(ch.reward);
    this.sound.playFanfare();

    eventBus.emit(EVENTS.NOTIFICATION, {
      text: `🏆 ${ch.title} ABGESCHLOSSEN! Belohnung: +$${ch.reward.toLocaleString()}!`,
    });

    if (this.currentChapterIndex < this.chapters.length - 1) {
      this.currentChapterIndex++;
      this.saveToLocalStorage();
      setTimeout(() => {
        this.announceCurrentChapter();
      }, 3500);
      return true;
    } else {
      this.saveToLocalStorage();
      eventBus.emit(EVENTS.NOTIFICATION, {
        text: '👑 GTA 7 STORY DURCHGESPIELT! Du bist der Boss von Los Cyberos!',
      });
      return false;
    }
  }

  public announceCurrentChapter(): void {
    const ch = this.getCurrentChapter();
    eventBus.emit(EVENTS.NOTIFICATION, {
      text: `📖 ${ch.title} | ${ch.speaker}: "${ch.dialogue}"`,
    });
  }
}

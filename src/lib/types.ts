// Zentrales Datenmodell. Alles, was gespeichert wird, steht hier.

export type ZoneId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
export type Level3 = 1 | 2 | 3
export type StatKey = 'fokus' | 'staerke' | 'business' | 'reichweite' | 'disziplin' | 'klarheit'

export interface Task {
  id: string
  title: string
  zone: ZoneId
  /** geschätzte Dauer in Minuten */
  minutes: number
  difficulty: Level3
  /** "Keinen Bock"-Faktor: wie sehr schiebe ich das auf? */
  dread: Level3
  /** deep = schwere/kreative Arbeit (morgens), light = Admin/Kleinkram (nachmittags) */
  kind: 'deep' | 'light'
  priority: Level3
  deadline?: string
  status: 'open' | 'done'
  /** geplanter Tag (YYYY-MM-DD). Ohne Datum = "irgendwann". */
  date?: string
  /** Main Quest an ihrem Tag */
  isMain?: boolean
  steps: string[]
  stepsDone: number
  startedAt?: number
  startXpGiven?: boolean
  doneAt?: number
  /** tatsächlich gearbeitete Minuten (Timer) */
  actualMinutes: number
  laterReason?: string
  /** Schritt einer Quest-Kette (GoalNode) */
  goalNodeId?: string
  /** Aufgabe "Ziel zerlegen": öffnet den Zerleger für dieses Ziel */
  breakdownGoalId?: string
  createdAt: number
}

export interface InboxItem {
  id: string
  text: string
  createdAt: number
}

export interface Idea {
  id: string
  text: string
  zone: ZoneId
  createdAt: number
}

export interface Daily {
  id: string
  title: string
  zone: ZoneId
  stat: StatKey
}

export interface Training {
  id: string
  type: 'gym' | 'ringen'
  /** 0 = Sonntag … 6 = Samstag */
  weekday: number
  time: string
  minutes: number
}

export type BlockType = 'routine' | 'meal' | 'training' | 'task' | 'break' | 'shutdown'

export interface Block {
  id: string
  type: BlockType
  title: string
  /** Minuten seit Mitternacht */
  start: number
  end: number
  taskId?: string
  zone?: ZoneId
  main?: boolean
  frog?: boolean
}

export interface DayPlan {
  date: string
  blocks: Block[]
  /** Aufgaben, die nicht mehr reingepasst haben */
  deferred: string[]
  /** Anteil der freien Zeit, der mit Aufgaben verplant ist (0–1) */
  plannedRatio: number
  builtAt: number
}

export interface DayLog {
  energy?: number
  sleep?: number
  minimal?: boolean
  checkinDone?: boolean
  dailiesDone: string[]
  blocksDone: string[]
  shutdownDone?: boolean
  /** Tag zählt für den Streak (mind. 1 Main Quest oder Shutdown) */
  counted?: boolean
  reflection?: string
  trainingNote?: string
  xp: number
  mainsDone: number
}

export interface MapCard {
  id: string
  zone: ZoneId
  questionId?: string
  text: string
}

export interface Goal {
  id: string
  zone: ZoneId
  title: string
}

/** Knoten einer Quest-Kette: Ziel → Zwischenziele → konkrete Schritte. */
export interface GoalNode {
  id: string
  goalId: string
  parentId?: string
  title: string
  order: number
  /** gesetzt = konkret genug für eine Sitzung (wird zur Quest) */
  minutes?: number
  done: boolean
  taskId?: string
}

export interface Reward {
  id: string
  title: string
  cost: number
}

export interface Profile {
  name: string
  wake: string
  sleep: string
  trainings: Training[]
  postGoal: number
  clients: string[]
  onboarded: boolean
  startDate: string
}

export interface Character {
  xp: number
  coins: number
  stats: Record<StatKey, number>
  streak: number
  bestStreak: number
  comebackPending: boolean
}

export interface Settings {
  theme: 'dark' | 'light'
  focusMinutes: number
  lastBackupAt?: number
}

export interface AppData {
  version: 1
  profile: Profile
  char: Character
  tasks: Task[]
  inbox: InboxItem[]
  ideas: Idea[]
  dailies: Daily[]
  rewards: Reward[]
  cards: MapCard[]
  goals: Goal[]
  nodes: GoalNode[]
  /** Zonen, deren Interview abgeschlossen ist */
  zonesDone: ZoneId[]
  plans: Record<string, DayPlan>
  days: Record<string, DayLog>
  settings: Settings
  /** letzter Tag, an dem die App den Tageswechsel verarbeitet hat */
  lastDate: string
}

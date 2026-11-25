
import { useEffect, useState, type FormEvent } from 'react';
import './App.css';

type Child = {
  id: number;
  name: string;
  photo?: string;
};
type Task = {
  id: number;
  title: string;
  child: number;
  start: string;
  end: string;
  stars: number;
  doneBy: number[];
  approvedBy: number[];
repeatType: 'none' | 'daily' | 'weekly' |'days' | 'monthly';
repeatDays: number[];
repeatWeekday: number;
taskDate: string;
};
type Reward = { id: number; title: string; cost: number };
type StarRecord = {
  id: string;
  childId: number;
  stars: number;
  date: string;
};
type WinnerRecord = {
  id: string;
  period: 'weekly' | 'monthly';
  winners: number[];
  stars: number;
  startDate: string;
  endDate: string;
};
type DailyCheckIn = {
  childId: number;
  date: string;
  shouted: string;
  kindWords: string;
  mood: string;
  sadness: string;
  sadnessNote: string;
  obeyed: string;
};
const defaultChildren: Child[] = [
  { id: 0, name: 'Iffa mol' },
  { id: 1, name: 'Shamon' },
];

function readStorage<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) as T : fallback;
  } catch {
    return fallback;
  }
}

function dateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getWeekStart(date: Date) {
  const monday = new Date(date);
  const day = monday.getDay();
  monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1));
  return dateKey(monday);
}
function toTime(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !value) return fallback;
  if (/^\d{2}:\d{2}/.test(value)) return value.slice(0, 5);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function loadChildren(): Child[] {
  const saved = readStorage<any[]>('kids-children', []);
  return defaultChildren.map((child, index) => {
    const old = saved.find(item => Number(item?.id) === index) ?? saved[index];
    return {
      id: index,
      name: typeof old?.name === 'string' && old.name.trim()
        ? old.name : child.name,
    };
  });
}

function loadTasks(): Task[] {
  const saved = readStorage<any[]>('kids-tasks', []);
  if (!Array.isArray(saved)) return [];

  return saved.map((item, index) => {
    const childValue = item.child ?? item.childId ?? item.assignedTo ?? 0;
    const child = childValue === 'both' || childValue === 'Both children'
      ? 2 : Number(childValue);

    const doneBy = Array.isArray(item.doneBy)
      ? item.doneBy.map(Number)
      : item.done === true || item.completed === true
        ? (child === 2 ? [0, 1] : [child]) : [];

    return {
      id: Number(item.id) || Date.now() + index,
      title: String(item.title ?? item.name ?? item.taskName ?? item.task ?? 'My task'),
      child: child === 1 || child === 2 ? child : 0,
      start: toTime(item.start ?? item.startTime, '17:00'),
      end: toTime(item.end ?? item.endTime, '18:00'),
      stars: Number(item.stars ?? 1) || 1,
      doneBy,
      approvedBy: Array.isArray(item.approvedBy)
        ? item.approvedBy.map(Number) : [],
    repeatType: item.repeatType ?? (item.repeatDaily ? 'days' : 'none'),
repeatDays: Array.isArray(item.repeatDays)
  ? item.repeatDays.map(Number)
  : (item.repeatDaily ? [1, 2, 3, 4, 5] : []),
repeatWeekday: Number(item.repeatWeekday ?? new Date(item.taskDate || dateKey()).getDay()),
taskDate: item.taskDate || dateKey(),};
  });
}

function playTickSound() {
  try {
    const AudioClass = window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioClass) return;
    const audio = new AudioClass();
    void audio.resume();

    [660, 880].forEach((frequency, index) => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const start = audio.currentTime + index * 0.13;
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(0.15, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.21);
    });
    window.setTimeout(() => void audio.close(), 700);
  } catch {
    // Browser may block sound.
  }
} function getTimeParts(value: string) {
  const [hour, minute] = value.split(':');
  const h = Number(hour);

  return {
    hour: String(h % 12 || 12),
    minute,
    period: h >= 12 ? 'PM' : 'AM'
  };
}
function formatTime(value: string) {
  const [hour, minute] = value.split(':').map(Number);
  const period = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${period}`;
}
function make24HourTime(hour: string, minute: string, period: string) {
  let h = Number(hour) % 12;
  if (period === 'PM') h += 12;

  return `${String(h).padStart(2, '0')}:${minute}`;
}

function addOneHour(value: string) {
  const [hour, minute] = value.split(':').map(Number);
  const total = (hour * 60 + minute + 60) % 1440;

  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
function TimePicker({ label, value, onChange, disabled = false }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const parts = getTimeParts(value);
  const [stage, setStage] = useState<'hour' | 'minute'>('hour');

  const numbers = stage === 'hour'
    ? Array.from({ length: 12 }, (_, i) => i === 0 ? 12 : i)
    : Array.from({ length: 12 }, (_, i) => i * 5);

  function chooseNumber(number: number) {
    if (stage === 'hour') {
      onChange(make24HourTime(String(number), parts.minute, parts.period));
      setStage('minute');
    } else {
      onChange(make24HourTime(parts.hour, String(number).padStart(2, '0'), parts.period));
    }
  }

  function adjustMinute(amount: number) {
    const minute = (Number(parts.minute) + amount + 60) % 60;
    onChange(make24HourTime(parts.hour, String(minute).padStart(2, '0'), parts.period));
  }

  return (
    <div className="clock-picker-label">
      <label>{label}</label>

      <div className="clock-display">
        <button type="button" disabled={disabled} onClick={() => setStage('hour')}>
          {parts.hour}
        </button>
        :
        <button type="button" disabled={disabled} onClick={() => setStage('minute')}>
          {parts.minute}
        </button>
        <button
          type="button"
          className="clock-period"
          disabled={disabled}
          onClick={() => onChange(make24HourTime(
            parts.hour,
            parts.minute,
            parts.period === 'AM' ? 'PM' : 'AM'
          ))}
        >
          {parts.period}
        </button>
      </div>

      {disabled ? (
        <p className="clock-instruction">Fixed one-hour duration</p>
      ) : (
        <>
          <p className="clock-instruction">
            Select {stage === 'hour' ? 'hour' : 'minutes'}
          </p>

          {stage === 'hour' ? (
            <div className="clock-face">
              {numbers.map(number => {
                const angle = (number / 12) * Math.PI * 2;
                const left = 50 + Math.sin(angle) * 40;
                const top = 50 - Math.cos(angle) * 40;
                const selected = Number(parts.hour) === number;

                return (
                  <button
                    type="button"
                    key={number}
                    className={`clock-number ${selected ? 'selected' : ''}`}
                    style={{ left: `${left}%`, top: `${top}%` }}
                    onClick={() => chooseNumber(number)}
                  >
                    {number}
                  </button>
                );
              })}
              <div className="clock-center" />
            </div>
          ) : (
            <div className="minute-picker">
              <div className="minute-options">
                {numbers.map(number => (
                  <button
                    type="button"
                    key={number}
                    className={Number(parts.minute) === number ? 'selected' : ''}
                    onClick={() => chooseNumber(number)}
                  >
                    {String(number).padStart(2, '0')}
                  </button>
                ))}
              </div>

              <div className="minute-adjust">
                <button type="button" onClick={() => adjustMinute(-1)}>−1</button>
                <span>Exact minute</span>
                <button type="button" onClick={() => adjustMinute(1)}>+1</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
 function App() {
  const [children, setChildren] = useState<Child[]>(loadChildren);
  const [photos, setPhotos] = useState<Record<number, string>>(
    () => readStorage('kids-photos', {})
  );
  const [tasks, setTasks] = useState<Task[]>(loadTasks);
  const [rewards, setRewards] = useState<Reward[]>(() => {
    const saved = readStorage<any[]>('kids-rewards', []);
    return Array.isArray(saved) ? saved.map((item, index) => ({
      id: Number(item.id) || Date.now() + index,
      title: String(item.title ?? item.name ?? 'Reward'),
      cost: Number(item.cost ?? 5),
    })) : [];
  });
  const [stars, setStars] = useState<number[]>(() => {
    const saved = readStorage<number[]>('kids-stars', [0, 0]);
    return [
      Math.max(0, Number(saved?.[0]) || 0),
      Math.max(0, Number(saved?.[1]) || 0),
    ];
  });
  const [starHistory, setStarHistory] = useState<StarRecord[]>(
    () => readStorage('kids-star-history', [])
  );
const [winnerHistory, setWinnerHistory] = useState<WinnerRecord[]>(
  () => (readStorage('kids-winner-history', []) as WinnerRecord[]).filter(
    item => item.id !== 'test-weekly'
  )
); 
const [checkIns, setCheckIns] = useState<DailyCheckIn[]>(
  () => readStorage('kids-daily-checkins', [])
);useEffect(() => {
  localStorage.setItem('kids-winner-history', JSON.stringify(winnerHistory));
}, [winnerHistory]);
 
const [view, setView] = useState<'kids' | 'parent'>('kids');
  const [theme, setTheme] = useState<'dream' | 'bunny' | 'sky' | 'jungle' | 'classic' | 'starry'>(() =>
    readStorage('kids-app-theme', 'dream')
  );

  useEffect(() => {
    localStorage.setItem('kids-app-theme', JSON.stringify(theme));
  }, [theme]);

const [showWinnerCelebration, setShowWinnerCelebration] = useState(false);
const [currentWinners, setCurrentWinners] = useState<WinnerRecord | null>(null);  const [selectedChild, setSelectedChild] = useState(0);
  const [taskTitle, setTaskTitle] = useState('');
const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [taskChild, setTaskChild] = useState(0);
  const [taskStart, setTaskStart] = useState('17:00');
  const [taskEnd, setTaskEnd] = useState('18:00');
  const [taskStars, setTaskStars] = useState(1);
  const [repeatType, setRepeatType] = useState<'none' | 'daily' | 'weekly' | 'days' | 'monthly'>('none');
const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [rewardTitle, setRewardTitle] = useState('');
  const [rewardCost, setRewardCost] = useState(5);
  const [editingRewardId, setEditingRewardId] = useState<number | null>(null);
 
 const [clock, setClock] = useState(() => getClock());
 const [, setCurrentTime] = useState(() => new Date());  const [today, setToday] = useState(() => dateKey());
const [lastWinnerCheck, setLastWinnerCheck] = useState('');
  function getClock() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }

  useEffect(() => {
    localStorage.setItem('kids-children', JSON.stringify(children));
  }, [children]);
useEffect(() => {
  const timer = setInterval(() => {
    setClock(getClock());
    setCurrentTime(new Date());
    setToday(dateKey());
  }, 1000);

  return () => clearInterval(timer);
}, []);
 useEffect(() => {
  const date = new Date();
  const day = date.getDay();
  const dateString = today;

  if (lastWinnerCheck === dateString) return;

  // Weekly winners: Monday to Friday
  if (day === 5) {
    const start = getWeekStart(date);
    const winner = calculateWinners(start, dateString, 'weekly');

    if (winner && !winnerHistory.some(item => item.id === `weekly-${dateString}`)) {
      const savedWinner = { ...winner, id: `weekly-${dateString}` };
      setWinnerHistory(old => [...old, savedWinner]);
      setCurrentWinners(savedWinner);
      setShowWinnerCelebration(true);
    }
  }

  // Monthly winners: first to last day
  const lastDay = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0
  ).getDate();

  if (date.getDate() === lastDay) {
    const start = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
    const winner = calculateWinners(start, dateString, 'monthly');

    if (winner && !winnerHistory.some(item => item.id === `monthly-${dateString}`)) {
      const savedWinner = { ...winner, id: `monthly-${dateString}` };
      setWinnerHistory(old => [...old, savedWinner]);
      setCurrentWinners(savedWinner);
      setShowWinnerCelebration(true);
    }
  }

  setLastWinnerCheck(dateString);
}, [today]);
 useEffect(() => {
    localStorage.setItem('kids-photos', JSON.stringify(photos));
  }, [photos]);

  useEffect(() => {
    localStorage.setItem('kids-tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('kids-rewards', JSON.stringify(rewards));
  }, [rewards]);

  useEffect(() => {
    localStorage.setItem('kids-stars', JSON.stringify(stars));
  }, [stars]);

  useEffect(() => {
    localStorage.setItem('kids-star-history', JSON.stringify(starHistory));
  }, [starHistory]);
useEffect(() => {
  localStorage.setItem('kids-winner-history', JSON.stringify(winnerHistory));
}, [winnerHistory]);
useEffect(() => {
  localStorage.setItem('kids-daily-checkins', JSON.stringify(checkIns));
}, [checkIns]);
 useEffect(() => {
  const currentDate = new Date();
  const currentDay = currentDate.getDay();
  const currentDayOfMonth = currentDate.getDate();

  setTasks(old => old.map(task => {
    if (task.taskDate === today) return task;

    let shouldRepeat = false;

    if (task.repeatType === 'daily') {
      shouldRepeat = true;
    } else if (task.repeatType === 'weekly') {
      shouldRepeat = currentDay === task.repeatWeekday;
    } else if (task.repeatType === 'days') {
      shouldRepeat = task.repeatDays.includes(currentDay);
    } else if (task.repeatType === 'monthly') {
      shouldRepeat = Number(task.taskDate.slice(-2)) === currentDayOfMonth;
    }

    if (!shouldRepeat) return task;

    return {
      ...task,
      taskDate: today,
      doneBy: [],
      approvedBy: [],
    };
  }));
}, [today]);
  function isAssigned(task: Task, childId: number) {
    return task.child === 2 || task.child === childId;
  }

  function isDone(task: Task, childId: number) {
    return (task.doneBy ?? []).includes(childId);
  }

  function isApproved(task: Task, childId: number) {
    return (task.approvedBy ?? []).includes(childId);
  }

  function isWithinTime(task: Task) {
  return clock >= task.start && clock < task.end;
}

  function markDone(task: Task, childId: number) {
  if (!isWithinTime(task) || isDone(task, childId)) return;

  playTickSound();

  const messages = [
    "Excellent! Well done!",
    "Amazing job! Keep it up!",
    "You are doing great!",
    "Superstar! Keep shining!",
    "Wonderful! I am proud of you!",
    "Fantastic work! Keep going!"
  ];

  const message = messages[Math.floor(Math.random() * messages.length)];

  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();

    const voice = new SpeechSynthesisUtterance(message);
    voice.lang = 'en-US';
    voice.rate = 0.9;
    voice.pitch = 1.2;
    voice.volume = 1;

    window.speechSynthesis.speak(voice);
  }

  setTasks(old => old.map(item =>
    item.id === task.id
      ? { ...item, doneBy: [...item.doneBy, childId] }
      : item
  ));
}
  function approveTask(task: Task, childId: number) {
    if (!isDone(task, childId) || isApproved(task, childId)) return;

    const record: StarRecord = {
      id: `${task.id}-${childId}-${dateKey()}`,
      childId,
      stars: task.stars,
      date: new Date().toISOString(),
    };

    setTasks(old => old.map(item =>
      item.id === task.id
        ? { ...item, approvedBy: [...item.approvedBy, childId] }
        : item
    ));

    setStars(old => {
      const updated = [...old];
      updated[childId] = (updated[childId] ?? 0) + task.stars;
      return updated;
    });

    setStarHistory(old =>
      old.some(item => item.id === record.id) ? old : [...old, record]
    );
  }

  function getStarHistory(childId: number) {
    const now = new Date();
    const todayKey = dateKey(now);
    const weekStart = getWeekStart(now);
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    let daily = 0;
    let weekly = 0;
    let monthly = 0;

    starHistory.forEach(record => {
      if (record.childId !== childId) return;
      const date = new Date(record.date);
      if (Number.isNaN(date.getTime())) return;
      const day = dateKey(date);
      const recordMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (day === todayKey) daily += record.stars;
      if (day >= weekStart && day <= todayKey) weekly += record.stars;
      if (recordMonth === month) monthly += record.stars;
    });

    return { daily, weekly, monthly };
  }
 function calculateWinners(
  startDate: string,
  endDate: string,
  period: 'weekly' | 'monthly'
): WinnerRecord | null {
  const totals = children.map(child => ({
    childId: child.id,
    stars: starHistory
      .filter(record => {
        const day = dateKey(new Date(record.date));
        return record.childId === child.id &&
          day >= startDate &&
          day <= endDate;
      })
      .reduce((sum, record) => sum + record.stars, 0),
  }));

  const highest = Math.max(0, ...totals.map(item => item.stars));
  if (highest === 0) return null;

  return {
    id: `${startDate}-${endDate}`,
    period,
    winners: totals.filter(item => item.stars === highest).map(item => item.childId),
    stars: highest,
    startDate,
    endDate,
  };
}
 function addTask(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  if (!taskTitle.trim()) return;

  if (repeatType === 'days' && repeatDays.length === 0) {
    alert('Please select at least one day.');
    return;
  }

  if (editingTaskId !== null) {
    setTasks(old => old.map(task =>
      task.id === editingTaskId
        ? {
            ...task,
            title: taskTitle.trim(),
            child: taskChild,
            start: taskStart,
            end: taskEnd,
            stars: taskStars,
            repeatType,
            repeatDays,
          }
        : task
    ));

    setEditingTaskId(null);
  } else {
    const currentDate = new Date();

    setTasks(old => [...old, {
      id: Date.now(),
      title: taskTitle.trim(),
      child: taskChild,
      start: taskStart,
      end: taskEnd,
      stars: taskStars,
      doneBy: [],
      approvedBy: [],
      repeatType,
      repeatDays,
      repeatWeekday: currentDate.getDay(),
      taskDate: dateKey(),
    }]);
  }

  setTaskTitle('');
  setRepeatType('none');
  setRepeatDays([]);
} 
function startEditingTask(task: Task) {
  setEditingTaskId(task.id);
  setTaskTitle(task.title);
  setTaskChild(task.child);
  setTaskStart(task.start);
  setTaskEnd(task.end);
  setTaskStars(task.stars);
  setRepeatType(task.repeatType);
  setRepeatDays(task.repeatDays ?? []);
}
  function setTaskType(type: string) {
    setTaskTitle(type);
    if (type === 'Prayer' || type === 'Homework') {
      const [hours, minutes] = taskStart.split(':').map(Number);
      const end = new Date();
      end.setHours(hours, minutes + 60, 0, 0);
      setTaskEnd(`${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`);
    }
  }

  function addReward(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  if (!rewardTitle.trim()) return;

  if (editingRewardId !== null) {
    setRewards(old => old.map(reward =>
      reward.id === editingRewardId
        ? { ...reward, title: rewardTitle.trim(), cost: rewardCost }
        : reward
    ));
    setEditingRewardId(null);
  } else {
    setRewards(old => [...old, {
      id: Date.now(),
      title: rewardTitle.trim(),
      cost: rewardCost,
    }]);
  }

  setRewardTitle('');
  setRewardCost(5);
}

function startEditingReward(reward: Reward) {
  setEditingRewardId(reward.id);
  setRewardTitle(reward.title);
  setRewardCost(reward.cost);
}

function deleteReward(rewardId: number) {
  if (!window.confirm('Are you sure you want to delete this reward?')) return;

  setRewards(old => old.filter(reward => reward.id !== rewardId));

  if (editingRewardId === rewardId) {
    setEditingRewardId(null);
    setRewardTitle('');
    setRewardCost(5);
  }
}  function redeemReward(reward: Reward) {
    if (stars[selectedChild] < reward.cost) return;
    setStars(old => old.map((value, index) =>
      index === selectedChild ? value - reward.cost : value
    ));
  }

  function uploadPhoto(childId: number, file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotos(old => ({ ...old, [childId]: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  }

 const childTasks = tasks.filter(task => {
  if (!isAssigned(task, selectedChild)) return false;

  if (task.repeatType === 'none') {
    return task.taskDate === today;
  }

  if (task.repeatType === 'daily') return true;

  if (task.repeatType === 'weekly') {
    return new Date().getDay() === task.repeatWeekday;
  }

  if (task.repeatType === 'days') {
    return task.repeatDays.includes(new Date().getDay());
  }

  if (task.repeatType === 'monthly') {
    return new Date().getDate() === Number(task.taskDate.slice(-2));
  }

  return false;
}); const history = getStarHistory(selectedChild);
function updateCheckIn(
  field: keyof Omit<DailyCheckIn, 'childId' | 'date'>,
  value: string
) {
  setCheckIns(old => {
    const existing = old.find(
      item => item.childId === selectedChild && item.date === today
    );

    const answers = existing ?? {
      childId: selectedChild,
      date: today,
      shouted: '',
      kindWords: '',
      mood: '',
      sadness: '',
      sadnessNote: '',
      obeyed: '',
    };

    return [
      ...old.filter(
        item => !(item.childId === selectedChild && item.date === today)
      ),
      { ...answers, [field]: value },
    ];
  });
}
  return (
    <div className={`app theme-${theme}`}>    
{showWinnerCelebration && currentWinners && (
  <div className="winner-celebration">
  {Array.from({ length: 70 }, (_, i) => (
  <span
    key={i}
    className="winner-confetti"
    style={{
      left: `${(i * 37) % 100}%`,
      animationDelay: `${(i % 12) * 0.25}s`,
      animationDuration: `${3 + (i % 5)}s`,
      backgroundColor: ['#ff477e', '#ffd166', '#06d6a0', '#4cc9f0', '#9b5de5'][i % 5],
    }}
  />
))}
  <div className="winner-card">
      <div className="winner-trophy">🏆</div>
      <h1>CONGRATULATIONS!</h1>
      <h2>
        {currentWinners.period === 'weekly'
          ? 'Weekly Star Winners!'
          : 'Monthly Star Winners!'}
      </h2>

      <div className="winner-photos">
        {children
          .filter(child => currentWinners.winners.includes(child.id))
          .map(child => (
            <div className="winner-person" key={child.id}>
              {photos[child.id] ? (
                <img
                  src={photos[child.id]}
                  alt={child.name}
                  className="winner-photo"
                />
              ) : (
                <div className="winner-photo winner-no-photo">🌟</div>
              )}
              <h2>{child.name}</h2>
            </div>
          ))}
      </div>

      <h2>⭐ {currentWinners.stars} Stars! ⭐</h2>
      <p>You are amazing! Keep shining!</p>

      <button onClick={() => setShowWinnerCelebration(false)}>
        Celebrate! 🎉
      </button>
    </div>
  </div>
)}
 <header className="app-header">
        <div>
          <h1>⭐ Star Rewards</h1>
          <p>Little tasks, big achievements!</p>
        </div>
        <div className="view-switch">
          <button className={view === 'kids' ? 'active' : ''} onClick={() => setView('kids')}>Kids</button>
          <button className={view === 'parent' ? 'active' : ''} onClick={() => setView('parent')}>Parent</button>
        </div>
      </header>

      {view === 'kids' && (
        <main className="main-content">
          <div className="child-selector">
            {children.map(child => (
              <button key={child.id} className={selectedChild === child.id ? 'active' : ''}
                onClick={() => setSelectedChild(child.id)}>
                {child.name}
              </button>
            ))}
          </div>

          <section className="child-welcome">
            <div className="child-photo">
              {photos[selectedChild]
                ? <img src={photos[selectedChild]} alt={children[selectedChild].name} />
                : <span>🌟</span>}
            </div>
            <div>
              <h2>Hello, {children[selectedChild].name}! 👋</h2>
              <p>You have {stars[selectedChild]} ⭐ stars</p>
            </div>
          </section>

          <section className="card">
            <h2>⭐ My Star History</h2>
            <div className="children-grid">
              <div className="child-card">
                <h3>Today</h3>
                <p>{history.daily} ⭐</p>
              </div>
              <div className="child-card">
                <h3>This Week</h3>
                <p>{history.weekly} ⭐</p>
              </div>
              <div className="child-card">
                <h3>This Month</h3>
                <p>{history.monthly} ⭐</p>
              </div>
            </div>
          </section>
{winnerHistory.length > 0 && (
  <section className="card">
    <h2>🏆 Winner History</h2>
    {winnerHistory.slice().reverse().map(winner => (
      <div className="child-card" key={winner.id}>
        <h3>
          {winner.period === 'weekly' ? '⭐ Weekly Winner' : '🌟 Monthly Winner'}
        </h3>
        <p>
          {winner.winners
            .map(id => children.find(child => child.id === id)?.name)
            .filter(Boolean)
            .join(' & ')}
        </p>
        <p>{winner.stars} ⭐ Stars</p>
        <small>{winner.startDate} – {winner.endDate}</small>
      </div>
    ))}
  </section>
)}
 <section className="card daily-checkin">
  <h2>💖 How Was My Day?</h2>
  <p>Answer honestly. Your feelings matter!</p>

  <label>1. Did you shout at your sibling?</label>
  <select value={checkIns.find(item => item.childId === selectedChild && item.date === today)?.shouted ?? ''} onChange={e => updateCheckIn('shouted', e.target.value)}>
    <option value="">Choose an answer</option>
    <option>Yes</option>
    <option>No</option>
    <option>Sometimes</option>
  </select>

  <label>2. Did you speak kindly to your siblings?</label>
  <select value={checkIns.find(item => item.childId === selectedChild && item.date === today)?.kindWords ?? ''} onChange={e => updateCheckIn('kindWords', e.target.value)}>
    <option value="">Choose an answer</option>
    <option>Yes</option>
    <option>No</option>
    <option>Sometimes</option>
  </select>

  <label>3. Are you happy today?</label>
  <select value={checkIns.find(item => item.childId === selectedChild && item.date === today)?.mood ?? ''} onChange={e => updateCheckIn('mood', e.target.value)}>
    <option value="">Choose an answer</option>
    <option>Happy 😊</option>
    <option>Okay 😐</option>
    <option>Sad 😢</option>
  </select>

  <label>4. Do you have any sadness?</label>
  <select value={checkIns.find(item => item.childId === selectedChild && item.date === today)?.sadness ?? ''} onChange={e => updateCheckIn('sadness', e.target.value)}>
    <option value="">Choose an answer</option>
    <option>Yes</option>
    <option>No</option>
  </select>

  {checkIns.find(item => item.childId === selectedChild && item.date === today)?.sadness === 'Yes' && (
    <textarea
      placeholder="Would you like to tell us what's making you sad?"
      value={checkIns.find(item => item.childId === selectedChild && item.date === today)?.sadnessNote ?? ''}
      onChange={e => updateCheckIn('sadnessNote', e.target.value)}
    />
  )}

  <label>5. Did you obey your parents today?</label>
  <select value={checkIns.find(item => item.childId === selectedChild && item.date === today)?.obeyed ?? ''} onChange={e => updateCheckIn('obeyed', e.target.value)}>
    <option value="">Choose an answer</option>
    <option>Yes</option>
    <option>No</option>
    <option>Sometimes</option>
  </select>

  <p>💗 Thank you for sharing your feelings!</p>
</section>   
<section className="encouragement-card">
  <div className="encouragement-characters">
    <span>🦄</span>
    <span>🐰</span>
    <span>⭐</span>
  </div>
  <h2>You Can Do It! 💜</h2>
  <p>Every little task makes you a superstar!</p>
  <p>Keep trying, keep smiling and keep shining! 🌈</p>
</section>    
<section className="card">
  <h2>Today's Tasks 📝</h2>

  {childTasks.length === 0 && (
    <p className="empty-message">No tasks added yet. Enjoy your day!</p>
  )}

  {childTasks.map(task => {
    const done = isDone(task, selectedChild);
    const approved = isApproved(task, selectedChild);
    const available = isWithinTime(task);

    const [startHour, startMinute] = task.start.split(':').map(Number);
    const [endHour, endMinute] = task.end.split(':').map(Number);

    let duration = (endHour * 60 + endMinute) -
                   (startHour * 60 + startMinute);

    if (duration < 0) duration += 1440;

    return (
      <div className="task-card task-card-compact" key={task.id}>
        <div className="task-info task-info-compact">
          <h3>{task.title}</h3>
          <p>
       {formatTime(task.start)} – {formatTime(task.end)} · {duration} min          </p>

          {approved && (
            <span className="task-status">Approved ✓</span>
          )}

          {done && !approved && (
            <span className="task-status">Waiting for approval</span>
          )}

          {!done && !available && (
            <span className="task-status">
              {clock < task.start
             ? `Starts at ${formatTime(task.start)}`               : "Time's up!"}
            </span>
          )}
        </div>

        <button
          type="button"
          className={`task-tick ${done ? 'checked' : ''}`}
          disabled={done || !available}
          onClick={() => markDone(task, selectedChild)}
          aria-label="Mark task as done"
        >
          {done ? '✓' : '☐'}
        </button>
      </div>
    );
  })}
</section>
          <section className="card">
            <h2>🎁 My Rewards</h2>
            {rewards.length === 0 && <p className="empty-message">Your rewards will appear here.</p>}
            {rewards.map(reward => (
              <div className="task-card" key={reward.id}>
                <div className="task-info">
                  <h3>{reward.title}</h3>
                  <p>{reward.cost} ⭐</p>
                </div>
                <button disabled={stars[selectedChild] < reward.cost}
                  onClick={() => redeemReward(reward)}>Redeem</button>
              </div>
            ))}
          </section>
        </main>
      )}


      {view === 'parent' && (
        <main className="main-content">
               <section className="card theme-settings">
            <h2>🎨 Choose App Theme</h2>
            <p>Pick your favourite look!</p>
            <div className="theme-options">
              <button onClick={() => setTheme('dream')}>🦄 Dream Magic</button>
              <button onClick={() => setTheme('bunny')}>🐰 Sweet Bunny</button>
              <button onClick={() => setTheme('sky')}>☁️ Sky Adventure</button>
              <button onClick={() => setTheme('jungle')}>🌿 Jungle Fun</button>
              <button onClick={() => setTheme('classic')}>🌸 Classic Calm</button>
              <button onClick={() => setTheme('starry')}>🌙 Starry Night</button>
            </div>
          </section>   
  <section className="card">
            <h2>👨‍👩‍👧‍👦 Children</h2>
            <div className="children-grid">
              {children.map(child => {
                const childHistory = getStarHistory(child.id);
                return (
                  <div className="child-card" key={child.id}>
                    <div className="child-photo">
                      {photos[child.id]
                        ? <img src={photos[child.id]} alt={child.name} />
                        : <span>🌟</span>}
                    </div>
                    <div className="child-name-edit">
  <input
    value={child.name}
    onChange={event => setChildren(old =>
      old.map(item =>
        item.id === child.id
          ? { ...item, name: event.target.value }
          : item
      )
    )}
    placeholder="Child's name"
  />
</div>
                    <p>{stars[child.id]} ⭐ stars</p>
                    <p>Today: {childHistory.daily} ⭐</p>
                    <p>This week: {childHistory.weekly} ⭐</p>
                    <p>This month: {childHistory.monthly} ⭐</p>
                    <label className="photo-upload">Choose photo
                      <input type="file" accept="image/*"
                        onChange={event => uploadPhoto(child.id, event.target.files?.[0])} />
                    </label>
                  </div>
                );
              })}
            </div>
          </section>
          <section className="card">
            <h2>💖 Children's Daily Check-in</h2>

            {children.map(child => {
              const answer = checkIns.find(
                item => item.childId === child.id && item.date === today
              );

              return (
                <div className="child-card" key={child.id}>
                  <h3>{child.name}</h3>

                  {!answer ? (
                    <p>Not completed yet today.</p>
                  ) : (
                    <>
                      <p>Shouted at sibling: {answer.shouted || 'Not answered'}</p>
                      <p>Spoke kindly: {answer.kindWords || 'Not answered'}</p>
                      <p>Today's mood: {answer.mood || 'Not answered'}</p>
                      <p>Feeling sad: {answer.sadness || 'Not answered'}</p>
                      {answer.sadnessNote && (
                        <p>What is making them sad: {answer.sadnessNote}</p>
                      )}
                      <p>Obeyed parents: {answer.obeyed || 'Not answered'}</p>
                    </>
                  )}
                </div>
              );
            })}
          </section>
          <section className="card">
          <h2>{editingTaskId !== null ? '✏️ Edit Task' : '➕ Add a Task'}</h2>         <form onSubmit={addTask} className="task-form">
              <label>Task name
                <input value={taskTitle} onChange={event => setTaskTitle(event.target.value)}
                  placeholder="Example: Clean your room" required />
              </label>
             <div className="quick-task-buttons">
  {['Prayer', 'Homework', 'Study', 'Clean room', 'Make bed', 'Brush teeth', 'Organise clothes', 'Help at home', 'Prepare school bag']
    .map(name => (
      <button type="button" key={name} onClick={() => setTaskType(name)}>
        {name}
      </button>
    ))}
</div>
 <label>Assign to
                <select value={taskChild} onChange={event => setTaskChild(Number(event.target.value))}>
                  <option value={0}>Iffa mol</option>
                  <option value={1}>Shamon</option>
                  <option value={2}>Both children</option>
                </select>
              </label>
             <div className="time-fields">
  <TimePicker
    label="Start time"
    value={taskStart}
    onChange={value => {
      setTaskStart(value);
      if (taskTitle === 'Prayer' || taskTitle === 'Homework') {
        setTaskEnd(addOneHour(value));
      }
    }}
  />

  <TimePicker
    label="End time"
    value={taskEnd}
    onChange={setTaskEnd}
    disabled={taskTitle === 'Prayer' || taskTitle === 'Homework'}
  />
</div>
              {(taskTitle === 'Prayer' || taskTitle === 'Homework') &&
                <p className="form-note">This task has a fixed one-hour time period.</p>}
              <label>Stars
                <input type="number" min="1" max="20" value={taskStars}
                  onChange={event => setTaskStars(Number(event.target.value))} />
              </label>

             <div className="repeat-option">
  <label htmlFor="repeatType">Repeat task</label>
  <select
    id="repeatType"
    value={repeatType}
    onChange={event => setRepeatType(event.target.value as typeof repeatType)}
  >
    <option value="none">Does not repeat</option>
    <option value="daily">Every day</option>
    <option value="weekly">Every week (same weekday)</option>
    <option value="days">Select days</option>
    <option value="monthly">Every month</option>
  </select>
</div>

{repeatType === 'days' && (
  <div className="repeat-option">
    <strong>Select days:</strong>
    {[
      { label: 'Monday', value: 1 },
      { label: 'Tuesday', value: 2 },
      { label: 'Wednesday', value: 3 },
      { label: 'Thursday', value: 4 },
      { label: 'Friday', value: 5 },
      { label: 'Saturday', value: 6 },
      { label: 'Sunday', value: 0 },
    ].map(day => (
      <label key={day.value}>
        <input
          type="checkbox"
          checked={repeatDays.includes(day.value)}
          onChange={event => {
            setRepeatDays(old =>
              event.target.checked
                ? [...old, day.value]
                : old.filter(value => value !== day.value)
            );
          }}
        />
        {day.label}
      </label>
    ))}
  </div>
)}
            <button type="submit">
  {editingTaskId !== null ? 'Update Task' : 'Add Task'}
</button>
{editingTaskId !== null && (
  <button type="button" onClick={() => {
    setEditingTaskId(null);
    setTaskTitle('');
    setRepeatType('none');
    setRepeatDays([]);
  }}>
    Cancel Edit
  </button>
)}
          </form>
          </section>

          <section className="card">
            <h2>📋 Task Approvals</h2>
           {tasks.length === 0 &&
  <p className="empty-message">No tasks have been added.</p>}
           {tasks.map(task => (
              <div className="approval-card" key={task.id}>
                <div className="task-info">
                  <h3>{task.title}</h3>
                  <p>{task.child === 2 ? 'Both children' : children[task.child]?.name}
                    {' · '}{task.start}–{task.end} · {task.stars} ⭐</p>
                  {task.repeatType !== 'none' && (
  <span className="task-status">
    {task.repeatType === 'daily' ? 'Every day' :
     task.repeatType === 'weekly' ? 'Every week' :
     task.repeatType === 'monthly' ? 'Every month' :
     `Selected days: ${task.repeatDays.map(day => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day]).join(', ')}`}
  </span>
)}            </div>
                <div className="approval-actions">
                  {children.filter(child => isAssigned(task, child.id)).map(child => (
                    <div className="approval-child" key={child.id}>
                      <span>{photos[child.id] && (
  <img
    src={photos[child.id]}
    alt={child.name}
    style={{
      width: '38px',
      height: '38px',
      borderRadius: '50%',
      objectFit: 'cover',
      verticalAlign: 'middle',
      marginRight: '8px'
    }}
  />
)}
{child.name}:</span>
                      {isApproved(task, child.id)
                        ? <span className="task-status">Approved ✓</span>
                        : isDone(task, child.id)
                          ? <button onClick={() => approveTask(task, child.id)}>Approve ⭐</button>
                          : <span>Not completed</span>}
                    </div>
                  ))}
               <button type="button" onClick={() => startEditingTask(task)}>
  Edit ✏️
</button>Add a Task
<button className="delete-button"
  onClick={() => setTasks(old => old.filter(item => item.id !== task.id))}>
  Delete
</button> </div>
              </div>
            ))}
          </section>

          <section className="card">
            <h2>🎁 Add a Reward</h2>
            <form onSubmit={addReward} className="task-form">
              <label>Reward name
                <input value={rewardTitle} onChange={event => setRewardTitle(event.target.value)}
                  placeholder="Example: Choose a movie" required />
              </label>
              <label>Stars needed
                <input type="number" min="1" value={rewardCost}
                  onChange={event => setRewardCost(Number(event.target.value))} />
              </label>
          <button type="submit">
  {editingRewardId !== null ? 'Save Changes' : 'Add Reward'}
</button>

{editingRewardId !== null && (
  <button type="button" onClick={() => {
    setEditingRewardId(null);
    setRewardTitle('');
    setRewardCost(5);
  }}>
    Cancel
  </button>
)}
            </form>
{rewards.length > 0 && (
  <div className="reward-management-list">
    <h3>Manage Rewards</h3>

    {rewards.map(reward => (
      <div className="task-card" key={reward.id}>
        <div className="task-info">
          <h3>{reward.title}</h3>
          <p>{reward.cost} ⭐</p>
        </div>

        <button type="button" onClick={() => startEditingReward(reward)}>
          Edit ✏️
        </button>

        <button
          type="button"
          className="delete-button"
          onClick={() => deleteReward(reward.id)}
        >
          Delete
        </button>
      </div>
    ))}
  </div>
)}
          </section>
        </main>
      )}
    </div>
  );
}

export default App;





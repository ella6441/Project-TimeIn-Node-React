import { useEffect, useState, useRef } from 'react';
import {
  Row, Col, Button, Select, Input, Space,
  Tag, Table, App, Modal, Form,
  DatePicker, TimePicker, InputNumber, Segmented,
} from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  StopOutlined,
  DeleteOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  ScheduleOutlined,
  PlusCircleOutlined,
} from '@ant-design/icons';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import dayjs from 'dayjs';
import { timerApi } from '../api/timer.api';
import { integrationsApi } from '../api/integrations.api';
import type { ClickUpTask } from '../api/integrations.api';
import { timeEntriesApi } from '../api/timeEntries.api';
import { projectsApi } from '../api/projects.api';
import { tasksApi } from '../api/tasks.api';
import { settingsApi } from '../api/settings.api';
import { reportsApi } from '../api/reports.api';
import { useAuthStore } from '../store/auth.store';
import type { TimeEntry, Project, Task } from '../types';

const PIE_COLORS = ['#1677ff', '#52c41a', '#fa8c16', '#722ed1', '#eb2f96', '#13c2c2', '#faad14', '#f5222d'];

interface TimerData {
  active: boolean;
  status?: 'running' | 'paused';
  projectId?: string;
  taskId?: string;
  description?: string | null;
  startTime?: string;
  elapsedMinutes?: number;
  elapsedMs?: number;
}

function formatMinutes(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

function formatElapsed(ms: number) {
  if (isNaN(ms) || ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const statusColor: Record<string, string> = {
  DRAFT: 'default',
  SUBMITTED: 'processing',
  APPROVED: 'success',
  REJECTED: 'error',
};

const DEFAULT_WORK_TYPES = ['DEVELOPMENT', 'DESIGN', 'MEETINGS', 'REVIEW', 'TESTING', 'OTHER'];

export default function Dashboard() {
  const { message } = App.useApp();
  const currentUser = useAuthStore((s) => s.user);
  const isManager = currentUser?.role === 'MANAGER' || currentUser?.role === 'ADMIN';
  const [timer, setTimer] = useState<TimerData | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [summary, setSummary] = useState({ todayMinutes: 0, weekMinutes: 0, monthMinutes: 0 });
  const [recentEntries, setRecentEntries] = useState<TimeEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [timerProject, setTimerProject] = useState<string | undefined>();
  const [timerTask, setTimerTask] = useState<string | undefined>();
  const [timerDesc, setTimerDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [workTypes, setWorkTypes] = useState<string[]>(DEFAULT_WORK_TYPES);
  const [requireDesc, setRequireDesc] = useState(false);
  const [teamByEmployee, setTeamByEmployee] = useState<{ fullName: string; totalMinutes: number }[]>([]);
  const [teamByProject, setTeamByProject] = useState<{ projectName: string; totalMinutes: number }[]>([]);

  // Stop modal
  const [stopModalOpen, setStopModalOpen] = useState(false);
  const [stopTasks, setStopTasks] = useState<Task[]>([]);
  const [stopClickupTasks, setStopClickupTasks] = useState<ClickUpTask[]>([]);
  const [stopForm] = Form.useForm();

  // Quick log modal
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const [quickLogLoading, setQuickLogLoading] = useState(false);
  const [quickLogForm] = Form.useForm();
  const [quickLogTasks, setQuickLogTasks] = useState<Task[]>([]);
  const [quickLogClickupTasks, setQuickLogClickupTasks] = useState<ClickUpTask[]>([]);
  const [quickLogMode, setQuickLogMode] = useState<'times' | 'duration'>('times');

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const baseElapsedRef = useRef(0);
  const countingFromRef = useRef(0);

  const loadSettings = async () => {
    try {
      const res = await settingsApi.findAll();
      const s: Record<string, string> = {};
      res.data.forEach((item) => { s[item.key] = item.value; });
      if (s['work_types']) {
        setWorkTypes(s['work_types'].split(',').map((t) => t.trim()).filter(Boolean));
      }
      setRequireDesc(s['require_description'] === 'true');
    } catch { /* ignore */ }
  };

  const applyTimerData = (data: TimerData | null) => {
    if (!data || !data.active) { setTimer(null); setElapsedMs(0); return; }
    setTimer(data);
    const baseMs = data.elapsedMs ?? (data.elapsedMinutes ?? 0) * 60 * 1000;
    baseElapsedRef.current = baseMs;
    countingFromRef.current = Date.now();
    setElapsedMs(baseMs);
  };

  const loadData = async () => {
    const [timerRes, summaryRes, entriesRes, projectsRes] = await Promise.allSettled([
      timerApi.getState(),
      timeEntriesApi.getSummary(),
      timeEntriesApi.findMine({ limit: 5 }),
      projectsApi.findAll({ limit: 100 }),
    ]);
    if (timerRes.status === 'fulfilled') applyTimerData(timerRes.value.data as unknown as TimerData);
    if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value.data);
    if (entriesRes.status === 'fulfilled') setRecentEntries(entriesRes.value.data.data);
    if (projectsRes.status === 'fulfilled') setProjects(projectsRes.value.data.data);
  };

  const loadTeamCharts = async () => {
    if (!isManager) return;
    const now = dayjs();
    const from = now.startOf('month').format('YYYY-MM-DD');
    const to = now.endOf('month').format('YYYY-MM-DD');
    try {
      const [empRes, projRes] = await Promise.allSettled([
        reportsApi.byEmployee({ from, to }),
        reportsApi.byProject({ from, to }),
      ]);
      if (empRes.status === 'fulfilled') {
        const data = empRes.value.data as { fullName: string; totalMinutes: number }[];
        setTeamByEmployee(data.slice(0, 10));
      }
      if (projRes.status === 'fulfilled') {
        const data = projRes.value.data as { projectName: string; totalMinutes: number }[];
        setTeamByProject(data.slice(0, 8));
      }
    } catch { /* ignore */ }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { loadData(); loadSettings(); loadTeamCharts(); }, []);

  useEffect(() => {
    if (timer?.status === 'running') {
      intervalRef.current = setInterval(() => {
        setElapsedMs(baseElapsedRef.current + (Date.now() - countingFromRef.current));
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [timer]);

  const loadTasks = async (projectId: string) => {
    try { const res = await tasksApi.findAll({ projectId, limit: 100 }); setTasks(res.data.data); }
    catch { setTasks([]); }
  };

  const loadQuickLogTasks = async (projectId: string) => {
    try { const res = await tasksApi.findAll({ projectId, limit: 100 }); setQuickLogTasks(res.data.data); }
    catch { setQuickLogTasks([]); }
  };

  const loadStopTasks = async (projectId: string) => {
    try { const res = await tasksApi.findAll({ projectId, limit: 100 }); setStopTasks(res.data.data); }
    catch { setStopTasks([]); }
  };

  const loadClickupTasks = async (projectId: string, setter: (t: ClickUpTask[]) => void) => {
    try { const res = await integrationsApi.getClickUpTasks({ projectId, limit: 100 }); setter(res.data.data); }
    catch { setter([]); }
  };

  const handleStart = async () => {
    if (!timerProject || !timerTask) { message.warning('Please select project and task'); return; }
    setLoading(true);
    try {
      const res = await timerApi.start({ projectId: timerProject, taskId: timerTask, description: timerDesc || undefined });
      applyTimerData({ active: true, ...(res.data as object) } as TimerData);
      message.success('Timer started');
    } catch (err: unknown) {
      message.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to start timer');
    } finally { setLoading(false); }
  };

  const handlePause = async () => {
    setLoading(true);
    try { const res = await timerApi.pause(); applyTimerData({ active: true, ...(res.data as object) } as TimerData); message.success('Timer paused'); }
    catch { message.error('Failed to pause timer'); } finally { setLoading(false); }
  };

  const handleResume = async () => {
    setLoading(true);
    try { const res = await timerApi.resume(); applyTimerData({ active: true, ...(res.data as object) } as TimerData); message.success('Timer resumed'); }
    catch { message.error('Failed to resume timer'); } finally { setLoading(false); }
  };

  const handleStop = () => {
    if (!timer) return;
    const now = dayjs();
    const startDayjs = timer.startTime ? dayjs(timer.startTime) : now.subtract(elapsedMs, 'ms');
    stopForm.setFieldsValue({
      projectId: timer.projectId,
      taskId: timer.taskId,
      date: now,
      startTime: startDayjs,
      endTime: now,
      description: timer.description ?? '',
      workType: 'DEVELOPMENT',
      relatedCommitHash: '',
      relatedClickUpTaskId: '',
    });
    if (timer.projectId) {
      loadStopTasks(timer.projectId);
      loadClickupTasks(timer.projectId, setStopClickupTasks);
    }
    setStopModalOpen(true);
  };

  const confirmStop = async () => {
    setLoading(true);
    try {
      const values = await stopForm.validateFields();
      const startVal = values.startTime as ReturnType<typeof dayjs>;
      const endVal = values.endTime as ReturnType<typeof dayjs>;
      const startMins = startVal.hour() * 60 + startVal.minute();
      const endMins = endVal.hour() * 60 + endVal.minute();
      const crossesMidnight = endMins <= startMins;
      const entry = await timerApi.stop();
      const dateDayjs = values.date as ReturnType<typeof dayjs>;
      const dateStr = dateDayjs.format('YYYY-MM-DD');
      const endDateStr = crossesMidnight ? dateDayjs.add(1, 'day').format('YYYY-MM-DD') : dateStr;
      await timeEntriesApi.update(entry.data.id, {
        projectId: values.projectId,
        taskId: values.taskId,
        date: dateStr,
        startTime: `${dateStr}T${startVal.format('HH:mm:ss')}`,
        endTime: `${endDateStr}T${endVal.format('HH:mm:ss')}`,
        description: values.description,
        workType: values.workType,
        relatedCommitHash: values.relatedCommitHash || undefined,
        relatedClickUpTaskId: values.relatedClickUpTaskId || undefined,
      });
      applyTimerData(null);
      setStopModalOpen(false);
      message.success('Timer stopped — time entry saved');
      loadData();
    } catch (err: unknown) {
      const raw = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
      const msg = Array.isArray(raw) ? (raw as string[])[0] : (raw as string | undefined);
      message.error(msg ?? 'Failed to stop timer');
    } finally { setLoading(false); }
  };

  const handleDiscard = async () => {
    setLoading(true);
    try { await timerApi.discard(); applyTimerData(null); message.success('Timer discarded'); }
    catch { message.error('Failed to discard timer'); } finally { setLoading(false); }
  };

  const handleQuickLog = async () => {
    setQuickLogLoading(true);
    try {
      const values = await quickLogForm.validateFields();
      const dateStr = (values.date as ReturnType<typeof dayjs>).format('YYYY-MM-DD');
      let startTimeStr: string;
      let endTimeStr: string;
      if (quickLogMode === 'duration') {
        const start = values.startTime as ReturnType<typeof dayjs>;
        const durationMins = Math.round((values.durationHours as number) * 60);
        const end = start.add(durationMins, 'minute');
        startTimeStr = `${dateStr}T${start.format('HH:mm:ss')}`;
        endTimeStr = `${dateStr}T${end.format('HH:mm:ss')}`;
      } else {
        const qs = values.startTime as ReturnType<typeof dayjs>;
        const qe = values.endTime as ReturnType<typeof dayjs>;
        const qStartMins = qs.hour() * 60 + qs.minute();
        const qEndMins = qe.hour() * 60 + qe.minute();
        const qCrossesMidnight = qEndMins <= qStartMins;
        const qDateDayjs = values.date as ReturnType<typeof dayjs>;
        const qEndDateStr = qCrossesMidnight ? qDateDayjs.add(1, 'day').format('YYYY-MM-DD') : dateStr;
        startTimeStr = `${dateStr}T${qs.format('HH:mm:ss')}`;
        endTimeStr = `${qEndDateStr}T${qe.format('HH:mm:ss')}`;
      }
      await timeEntriesApi.create({
        date: dateStr,
        projectId: values.projectId as string,
        taskId: values.taskId as string,
        startTime: startTimeStr,
        endTime: endTimeStr,
        description: values.description as string | undefined,
      });
      message.success('Time entry logged');
      setQuickLogOpen(false);
      quickLogForm.resetFields();
      setQuickLogTasks([]);
      setQuickLogMode('times');
      loadData();
    } catch (err: unknown) {
      const raw = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
      const msg = Array.isArray(raw) ? (raw as string[])[0] : (raw as string | undefined);
      message.error(msg ?? 'Failed to log time');
    } finally { setQuickLogLoading(false); }
  };

  const timerPercent = Math.min(Math.round((elapsedMs / (8 * 3600 * 1000)) * 100), 100);

  const recentColumns = [
    { title: 'Date', dataIndex: 'date', width: 100, render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
    { title: 'Project', dataIndex: ['project', 'projectName'] },
    { title: 'Task', dataIndex: ['task', 'taskName'], render: (v: string | undefined) => v ?? '—' },
    { title: 'Duration', dataIndex: 'durationMinutes', width: 100, render: (v: number) => formatMinutes(v) },
    { title: 'Status', dataIndex: 'status', width: 110, render: (v: string) => <Tag color={statusColor[v]}>{v}</Tag> },
  ];

  const stopProjectName = projects.find((p) => p.id === timer?.projectId)?.projectName;
  const stopTaskName = stopTasks.find((t) => t.id === timer?.taskId)?.taskName;
  const greetingHour = new Date().getHours();
  const greeting = greetingHour < 12 ? 'Good morning' : greetingHour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div style={{ background: '#f7f8fa', margin: -24, padding: 28, minHeight: 'calc(100vh - 64px)' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#111', lineHeight: 1.2 }}>
          {greeting}, {currentUser?.fullName?.split(' ')[0]} 👋
        </div>
        <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
          {dayjs().format('dddd, MMMM D, YYYY')}
        </div>
      </div>

      {/* ── Stats ── */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {[
          { label: 'Today',      minutes: summary.todayMinutes, goal: 480,  icon: <ClockCircleOutlined /> },
          { label: 'This Week',  minutes: summary.weekMinutes,  goal: 2400, icon: <CalendarOutlined /> },
          { label: 'This Month', minutes: summary.monthMinutes, goal: 9600, icon: <ScheduleOutlined /> },
        ].map(({ label, minutes, goal, icon }) => {
          const pct = Math.min(Math.round((minutes / goal) * 100), 100);
          return (
            <Col xs={24} sm={8} key={label}>
              <div style={{
                background: '#fff',
                borderRadius: 14,
                border: '1px solid #f0f0f0',
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                overflow: 'hidden',
              }}>
                <div style={{ height: 4, background: 'linear-gradient(90deg, #1677ff 0%, #0ea5e9 100%)' }} />
              <div style={{
                padding: '18px 20px',
                display: 'flex', alignItems: 'center', gap: 16,
              }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 10, flexShrink: 0,
                  background: '#f0f7ff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 17, color: '#1677ff',
                }}>
                  {icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#8c8c8c', letterSpacing: 0.3, marginBottom: 3 }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
                    {formatMinutes(minutes)}
                  </div>
                  <div style={{ fontSize: 11, color: '#bfbfbf', marginTop: 4 }}>{pct}% of goal</div>
                </div>
              </div>
              </div>
            </Col>
          );
        })}
      </Row>

      {/* ── Timer + Quick Log ── */}
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.25} }
        .row-gray td { background: #f7f8fa !important; }
      `}</style>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {/* ── Timer card ── */}
        <Col xs={24} lg={16}>
          <div style={{
            background: '#fff',
            borderRadius: 16,
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
            overflow: 'hidden',
            height: '100%',
          }}>
            {/* Status bar — colored top strip when active */}
            <div style={{
              height: 3,
              background: timer
                ? timer.status === 'running'
                  ? 'linear-gradient(90deg,#1677ff,#40a9ff)'
                  : 'linear-gradient(90deg,#faad14,#ffd666)'
                : '#f0f0f0',
              transition: 'background 0.4s',
            }} />

            {/* Header */}
            <div style={{
              padding: '14px 20px',
              borderBottom: '1px solid #f5f5f5',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <ClockCircleOutlined style={{ color: '#1677ff', fontSize: 15, animation: timer?.status === 'running' ? 'blink 1.6s ease-in-out infinite' : 'none' }} />
              <span style={{ fontWeight: 600, fontSize: 14, color: '#1a1a2e' }}>Time Tracker</span>
              <span style={{ marginLeft: 'auto' }}>
                {timer ? (
                  <Tag color={timer.status === 'running' ? 'success' : 'warning'}>
                    <span style={{
                      display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                      background: timer.status === 'running' ? '#52c41a' : '#faad14',
                      marginRight: 5, verticalAlign: 'middle',
                      animation: timer.status === 'running' ? 'blink 1.6s ease-in-out infinite' : 'none',
                    }} />
                    {timer.status === 'running' ? 'Running' : 'Paused'}
                  </Tag>
                ) : (
                  <Tag>Idle</Tag>
                )}
              </span>
            </div>

            <div style={{ padding: '24px 20px' }}>
              {timer ? (
                <div style={{ textAlign: 'center' }}>
                  {/* Project / Task */}
                  {(() => {
                    const proj = projects.find((p) => p.id === timer.projectId);
                    const task = tasks.find((t) => t.id === timer.taskId) || stopTasks.find((t) => t.id === timer.taskId);
                    return proj || task ? (
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                        {proj && <Tag color="blue">{proj.projectName}</Tag>}
                        {task && <Tag color="purple">{task.taskName}</Tag>}
                        {timer.description && <Tag color="default" style={{ fontStyle: 'italic' }}>{timer.description}</Tag>}
                      </div>
                    ) : null;
                  })()}

                  {/* Time display */}
                  <div style={{
                    fontSize: 56, fontWeight: 800,
                    fontFamily: '"SF Mono", ui-monospace, monospace',
                    letterSpacing: 3, lineHeight: 1,
                    color: timer.status === 'running' ? '#1a1a2e' : '#bfbfbf',
                    marginBottom: 16,
                    transition: 'color 0.3s',
                  }}>
                    {formatElapsed(elapsedMs)}
                  </div>

                  {/* Progress bar */}
                  <div style={{ padding: '0 32px', marginBottom: 24 }}>
                    <div style={{ height: 6, background: '#f0f2f5', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 3,
                        width: `${timerPercent}%`,
                        background: timer.status === 'running'
                          ? 'linear-gradient(90deg,#1677ff,#40a9ff)'
                          : 'linear-gradient(90deg,#faad14,#ffd666)',
                        transition: 'width 1s linear, background 0.4s',
                      }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#bfbfbf', marginTop: 5 }}>
                      <span>{timerPercent}% of 8h workday</span>
                      <span>{formatElapsed(Math.max(0, 8 * 3600 * 1000 - elapsedMs))} left</span>
                    </div>
                  </div>

                  {/* Buttons */}
                  <Space size={8} wrap>
                    {timer.status === 'running' ? (
                      <Button icon={<PauseCircleOutlined />} onClick={handlePause} loading={loading} size="large" style={{ borderRadius: 8, fontWeight: 600 }}>
                        Pause
                      </Button>
                    ) : (
                      <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleResume} loading={loading} size="large" style={{ borderRadius: 8, fontWeight: 600 }}>
                        Resume
                      </Button>
                    )}
                    <Button type="primary" danger icon={<StopOutlined />} onClick={handleStop} loading={loading} size="large" style={{ borderRadius: 8, fontWeight: 600 }}>
                      Stop & Save
                    </Button>
                    <Button icon={<DeleteOutlined />} onClick={handleDiscard} loading={loading} size="large" style={{ borderRadius: 8, color: '#bfbfbf' }}>
                      Discard
                    </Button>
                  </Space>
                </div>
              ) : (
                <div>
                  {/* Idle placeholder */}
                  <div style={{ textAlign: 'center', marginBottom: 20 }}>
                    <div style={{
                      fontSize: 48, fontWeight: 800,
                      fontFamily: '"SF Mono", ui-monospace, monospace',
                      color: '#e8eaed', letterSpacing: 3, lineHeight: 1, marginBottom: 6,
                      userSelect: 'none',
                    }}>00:00:00</div>
                    <div style={{ fontSize: 11, color: '#1677ff', letterSpacing: 2, fontWeight: 600 }}>
                      SELECT PROJECT & TASK TO BEGIN
                    </div>
                  </div>
                  <div style={{ height: 1, background: '#f5f5f5', marginBottom: 16 }} />
                  <Row gutter={10} style={{ marginBottom: 10 }}>
                    <Col xs={24} sm={8}>
                      <Select placeholder="Select project" style={{ width: '100%' }} value={timerProject} size="large"
                        onChange={(v) => { setTimerProject(v); setTimerTask(undefined); loadTasks(v); }}
                        options={projects.map((p) => ({ value: p.id, label: p.projectName }))} />
                    </Col>
                    <Col xs={24} sm={8}>
                      <Select placeholder="Select task" style={{ width: '100%' }} value={timerTask} size="large"
                        onChange={setTimerTask} disabled={!timerProject}
                        options={tasks.map((t) => ({ value: t.id, label: t.taskName }))} />
                    </Col>
                    <Col xs={24} sm={8}>
                      <Input placeholder="What are you working on? (optional)" value={timerDesc} size="large"
                        onChange={(e) => setTimerDesc(e.target.value)} style={{ borderRadius: 8 }} />
                    </Col>
                  </Row>
                  <Row gutter={10}>
                    <Col xs={24}>
                      <Button type="primary" block icon={<PlayCircleOutlined />} size="large"
                        onClick={handleStart} loading={loading}
                        style={{ borderRadius: 8, fontWeight: 700, height: 40 }}>
                        Start
                      </Button>
                    </Col>
                  </Row>
                </div>
              )}
            </div>
          </div>
        </Col>

        {/* ── Log Time card ── */}
        <Col xs={24} lg={8}>
          <div style={{
            background: 'linear-gradient(145deg, #1a1a2e 0%, #16213e 100%)',
            borderRadius: 16,
            boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
            height: '100%',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '32px 24px', textAlign: 'center', gap: 16,
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: 'rgba(22,119,255,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, color: '#40a9ff',
            }}>
              <PlusCircleOutlined />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#fff', marginBottom: 6 }}>Log Time Manually</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7 }}>
                No timer? Log your hours<br />with exact start & end times
              </div>
            </div>
            <Button size="large" icon={<PlusCircleOutlined />} onClick={() => setQuickLogOpen(true)}
              style={{
                borderRadius: 10, fontWeight: 700, height: 44, paddingInline: 28,
                background: 'rgba(255,255,255,0.1)', color: '#fff',
                border: '1px solid rgba(255,255,255,0.18)',
              }}>
              Log Time
            </Button>
          </div>
        </Col>
      </Row>

      {/* ── Team Charts (Manager / Admin only) ── */}
      {isManager && (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#888', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>
            Team Overview — {dayjs().format('MMMM YYYY')}
          </div>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col xs={24} lg={14}>
              <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', padding: '20px 16px 12px', minHeight: 180 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1a2e', marginBottom: 4, paddingLeft: 8 }}>Hours by Employee</div>
                <div style={{ fontSize: 12, color: '#aaa', marginBottom: 16, paddingLeft: 8 }}>Total logged this month</div>
                {teamByEmployee.length > 0 ? (
                  <ResponsiveContainer width="100%" height={Math.max(180, teamByEmployee.length * 38)}>
                    <BarChart data={teamByEmployee} layout="vertical" margin={{ left: 0, right: 28, top: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f5f5f5" />
                      <XAxis type="number" tickFormatter={(v: number) => `${Math.floor(v / 60)}h`} tick={{ fontSize: 11, fill: '#bbb' }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="fullName" width={96} tick={{ fontSize: 12, fill: '#555', fontWeight: 500 }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v) => [`${Math.floor((v as number) / 60)}h ${(v as number) % 60}m`, 'Logged']} contentStyle={{ borderRadius: 10, fontSize: 12, border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }} cursor={{ fill: '#f7f8fa' }} />
                      <Bar dataKey="totalMinutes" radius={[0, 6, 6, 0]} maxBarSize={20}>
                        {teamByEmployee.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, color: '#bfbfbf', fontSize: 13 }}>
                    No time entries logged this month
                  </div>
                )}
              </div>
            </Col>
            <Col xs={24} lg={10}>
              <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', padding: '20px 16px 12px', height: '100%', minHeight: 180 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1a2e', marginBottom: 4 }}>Time by Project</div>
                <div style={{ fontSize: 12, color: '#aaa', marginBottom: 8 }}>Distribution this month</div>
                {teamByProject.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={teamByProject} dataKey="totalMinutes" nameKey="projectName" cx="50%" cy="44%" outerRadius={82} innerRadius={46} paddingAngle={3} label={({ percent }) => `${Math.round((percent ?? 0) * 100)}%`} labelLine={false}>
                        {teamByProject.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => [`${Math.floor((v as number) / 60)}h ${(v as number) % 60}m`]} contentStyle={{ borderRadius: 10, fontSize: 12, border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }} />
                      <Legend iconType="circle" iconSize={8} formatter={(value) => <span style={{ fontSize: 11, color: '#666' }}>{value}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, color: '#bfbfbf', fontSize: 13 }}>
                    No project data this month
                  </div>
                )}
              </div>
            </Col>
          </Row>
        </>
      )}

      {/* ── Recent Entries ── */}
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#888', letterSpacing: 1, textTransform: 'uppercase' }}>
          Recent Activity
        </div>
      </div>
      <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden', marginBottom: 20 }}>
        <Table
          dataSource={recentEntries}
          columns={recentColumns}
          rowKey="id"
          pagination={false}
          size="middle"
          rowClassName={(_, index) => index % 2 === 1 ? 'row-gray' : ''}
          style={{ borderRadius: 16 }}
        />
      </div>

      {/* ── Stop Timer Modal ── */}
      <Modal
        title="Stop Timer & Save Entry"
        open={stopModalOpen}
        onOk={confirmStop}
        onCancel={() => setStopModalOpen(false)}
        okText="Save Entry"
        confirmLoading={loading}
        destroyOnHidden
        width={520}
      >
        <div style={{ background: '#fafafa', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#555' }}>
          <strong>{stopProjectName ?? '—'}</strong>
          {stopTaskName ? ` / ${stopTaskName}` : ''}
          <span style={{ float: 'right', fontFamily: 'monospace', color: '#1677ff' }}>
            {formatElapsed(elapsedMs)}
          </span>
        </div>
        <Form form={stopForm} layout="vertical">
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="date" label="Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="startTime" label="Start" rules={[{ required: true }]}>
                <TimePicker format="HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="endTime" label="End" rules={[{ required: true }]}>
                <TimePicker format="HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Description" rules={requireDesc ? [{ required: true, message: 'Description is required' }] : []}>
            <Input.TextArea rows={2} placeholder="What did you work on?" />
          </Form.Item>
          <Form.Item name="workType" label="Work Type">
            <Select options={workTypes.map((w) => ({ value: w, label: w }))} placeholder="Select type" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="relatedCommitHash" label="Commit Hash">
                <Input placeholder="e.g. abc123f" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="relatedClickUpTaskId" label="ClickUp Task">
                {stopClickupTasks.length > 0 ? (
                  <Select
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    placeholder="Select ClickUp task"
                    options={stopClickupTasks.map((t) => ({ value: t.clickUpTaskId, label: `${t.taskName} (#${t.clickUpTaskId})` }))}
                  />
                ) : (
                  <Input placeholder="e.g. #abc123" />
                )}
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* ── Quick Log Modal ── */}
      <Modal
        title="Log Time Manually"
        open={quickLogOpen}
        onOk={handleQuickLog}
        onCancel={() => { setQuickLogOpen(false); quickLogForm.resetFields(); setQuickLogTasks([]); setQuickLogMode('times'); }}
        okText="Log Time"
        confirmLoading={quickLogLoading}
        destroyOnHidden
        width={480}
      >
        <Form form={quickLogForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="date" label="Date" initialValue={dayjs()} rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="projectId" label="Project" rules={[{ required: true }]}>
            <Select
              placeholder="Select project"
              options={projects.map((p) => ({ value: p.id, label: p.projectName }))}
              onChange={(v) => { quickLogForm.setFieldValue('taskId', undefined); loadQuickLogTasks(v as string); loadClickupTasks(v as string, setQuickLogClickupTasks); }}
            />
          </Form.Item>
          <Form.Item name="taskId" label="Task" rules={[{ required: true }]}>
            <Select
              placeholder="Select task"
              options={quickLogTasks.map((t) => ({ value: t.id, label: t.taskName }))}
            />
          </Form.Item>

          <div style={{ marginBottom: 12 }}>
            <Segmented
              value={quickLogMode}
              onChange={(v) => { setQuickLogMode(v as 'times' | 'duration'); quickLogForm.setFieldValue('endTime', undefined); quickLogForm.setFieldValue('durationHours', undefined); }}
              options={[
                { label: 'Start / End Time', value: 'times' },
                { label: 'Duration', value: 'duration' },
              ]}
              block
            />
          </div>

          {quickLogMode === 'times' ? (
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="startTime" label="Start Time" rules={[{ required: true }]}>
                  <TimePicker format="HH:mm" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="endTime" label="End Time" rules={[{ required: true }]}>
                  <TimePicker format="HH:mm" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
          ) : (
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="startTime" label="Start Time" rules={[{ required: true }]}>
                  <TimePicker format="HH:mm" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="durationHours" label="Duration (hours)" rules={[{ required: true, type: 'number', min: 0.1 }]}>
                  <InputNumber min={0.1} max={24} step={0.5} style={{ width: '100%' }} placeholder="e.g. 1.5" />
                </Form.Item>
              </Col>
            </Row>
          )}

          <Form.Item name="description" label="Description" rules={requireDesc ? [{ required: true, message: 'Description is required' }] : []}>
            <Input.TextArea rows={2} placeholder="What did you work on?" />
          </Form.Item>
          {quickLogClickupTasks.length > 0 && (
            <Form.Item name="relatedClickUpTaskId" label="ClickUp Task">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Link to ClickUp task (optional)"
                options={quickLogClickupTasks.map((t) => ({ value: t.clickUpTaskId, label: `${t.taskName} (#${t.clickUpTaskId})` }))}
              />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
}

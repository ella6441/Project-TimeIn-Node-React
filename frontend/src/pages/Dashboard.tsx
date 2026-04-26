import { useEffect, useState, useRef } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Button,
  Select,
  Input,
  Typography,
  Space,
  Tag,
  Table,
  App,
  Divider,
  Modal,
  Form,
  Progress,
} from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  StopOutlined,
  DeleteOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { timerApi } from '../api/timer.api';
import { timeEntriesApi } from '../api/timeEntries.api';
import { projectsApi } from '../api/projects.api';
import { tasksApi } from '../api/tasks.api';
import type { TimeEntry, Project, Task } from '../types';

interface BreakdownItem {
  projectId: string;
  projectName: string;
  taskId: string;
  taskName: string;
  totalMinutes: number;
}

const { Title } = Typography;

interface TimerData {
  active: boolean;
  status?: 'running' | 'paused';
  projectId?: string;
  taskId?: string;
  description?: string | null;
  startTime?: string;
  elapsedMinutes?: number;
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

export default function Dashboard() {
  const { message } = App.useApp();
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
  const [breakdown, setBreakdown] = useState<BreakdownItem[]>([]);
  const [stopModalOpen, setStopModalOpen] = useState(false);
  const [stopForm] = Form.useForm();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const baseElapsedRef = useRef(0);
  const countingFromRef = useRef(0);

  useEffect(() => {
    loadData();
  }, []);

  const applyTimerData = (data: TimerData | null) => {
    if (!data || !data.active) {
      setTimer(null);
      setElapsedMs(0);
      return;
    }
    setTimer(data);
    const baseMs = (data.elapsedMinutes ?? 0) * 60 * 1000;
    baseElapsedRef.current = baseMs;
    countingFromRef.current = Date.now();
    setElapsedMs(baseMs);
  };

  useEffect(() => {
    if (timer?.status === 'running') {
      intervalRef.current = setInterval(() => {
        setElapsedMs(baseElapsedRef.current + (Date.now() - countingFromRef.current));
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timer]);

  const loadData = async () => {
    const [timerRes, summaryRes, entriesRes, projectsRes, breakdownRes] = await Promise.allSettled([
      timerApi.getState(),
      timeEntriesApi.getSummary(),
      timeEntriesApi.findMine({ limit: 5 }),
      projectsApi.findAll({ limit: 100 }),
      timeEntriesApi.getMyBreakdown(),
    ]);

    if (timerRes.status === 'fulfilled') {
      applyTimerData(timerRes.value.data as TimerData);
    }
    if (summaryRes.status === 'fulfilled') {
      setSummary(summaryRes.value.data);
    }
    if (entriesRes.status === 'fulfilled') {
      setRecentEntries(entriesRes.value.data.data);
    }
    if (projectsRes.status === 'fulfilled') {
      setProjects(projectsRes.value.data.data);
    }
    if (breakdownRes.status === 'fulfilled') {
      setBreakdown(breakdownRes.value.data as BreakdownItem[]);
    }
  };

  const loadTasks = async (projectId: string) => {
    try {
      const res = await tasksApi.findAll({ projectId, limit: 100 });
      setTasks(res.data.data);
    } catch {
      setTasks([]);
    }
  };

  const handleStart = async () => {
    if (!timerProject || !timerTask) {
      message.warning('Please select project and task');
      return;
    }
    setLoading(true);
    try {
      const res = await timerApi.start({
        projectId: timerProject,
        taskId: timerTask,
        description: timerDesc || undefined,
      });
      applyTimerData({ active: true, ...(res.data as object) } as TimerData);
      message.success('Timer started');
    } catch (err: unknown) {
      message.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to start timer',
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async () => {
    setLoading(true);
    try {
      const res = await timerApi.pause();
      applyTimerData({ active: true, ...(res.data as object) } as TimerData);
      message.success('Timer paused');
    } catch {
      message.error('Failed to pause timer');
    } finally {
      setLoading(false);
    }
  };

  const handleResume = async () => {
    setLoading(true);
    try {
      const res = await timerApi.resume();
      applyTimerData({ active: true, ...(res.data as object) } as TimerData);
      message.success('Timer resumed');
    } catch {
      message.error('Failed to resume timer');
    } finally {
      setLoading(false);
    }
  };

  const handleStop = () => {
    stopForm.resetFields();
    setStopModalOpen(true);
  };

  const confirmStop = async () => {
    setLoading(true);
    try {
      const entry = await timerApi.stop();
      const commitHash = stopForm.getFieldValue('relatedCommitHash');
      if (commitHash && entry.data?.id) {
        await import('../api/timeEntries.api').then(({ timeEntriesApi }) =>
          timeEntriesApi.update(entry.data.id, { relatedCommitHash: commitHash }),
        );
      }
      applyTimerData(null);
      setStopModalOpen(false);
      message.success('Timer stopped — time entry created');
      loadData();
    } catch {
      message.error('Failed to stop timer');
    } finally {
      setLoading(false);
    }
  };

  const handleDiscard = async () => {
    setLoading(true);
    try {
      await timerApi.discard();
      applyTimerData(null);
      message.success('Timer discarded');
    } catch {
      message.error('Failed to discard timer');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Date',
      dataIndex: 'date',
      render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Project',
      dataIndex: ['project', 'projectName'],
    },
    {
      title: 'Task',
      dataIndex: ['task', 'taskName'],
    },
    {
      title: 'Duration',
      dataIndex: 'durationMinutes',
      render: (v: number) => formatMinutes(v),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (v: string) => <Tag color={statusColor[v]}>{v}</Tag>,
    },
  ];

  return (
    <div>
      <Title level={4} style={{ marginTop: 0, marginBottom: 24 }}>
        Dashboard
      </Title>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Today"
              value={formatMinutes(summary.todayMinutes)}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="This Week"
              value={formatMinutes(summary.weekMinutes)}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="This Month"
              value={formatMinutes(summary.monthMinutes)}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Timer" style={{ marginBottom: 24 }}>
        {timer ? (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div
                style={{
                  fontSize: 48,
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  color: timer.status === 'running' ? '#1677ff' : '#faad14',
                  letterSpacing: 2,
                }}
              >
                {formatElapsed(elapsedMs)}
              </div>
              <Tag
                color={timer.status === 'running' ? 'processing' : 'warning'}
                style={{ marginTop: 8 }}
              >
                {timer.status?.toUpperCase()}
              </Tag>
            </div>
            <Space wrap style={{ justifyContent: 'center', width: '100%' }}>
              {timer.status === 'running' ? (
                <Button icon={<PauseCircleOutlined />} onClick={handlePause} loading={loading}>
                  Pause
                </Button>
              ) : (
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={handleResume}
                  loading={loading}
                >
                  Resume
                </Button>
              )}
              <Button
                type="primary"
                danger
                icon={<StopOutlined />}
                onClick={handleStop}
                loading={loading}
              >
                Stop & Save
              </Button>
              <Button icon={<DeleteOutlined />} onClick={handleDiscard} loading={loading} danger>
                Discard
              </Button>
            </Space>
          </div>
        ) : (
          <div>
            <Row gutter={12} style={{ marginBottom: 12 }}>
              <Col xs={24} sm={10}>
                <Select
                  placeholder="Select project"
                  style={{ width: '100%' }}
                  value={timerProject}
                  onChange={(v) => {
                    setTimerProject(v);
                    setTimerTask(undefined);
                    loadTasks(v);
                  }}
                  options={projects.map((p) => ({ value: p.id, label: p.projectName }))}
                />
              </Col>
              <Col xs={24} sm={10}>
                <Select
                  placeholder="Select task"
                  style={{ width: '100%' }}
                  value={timerTask}
                  onChange={setTimerTask}
                  disabled={!timerProject}
                  options={tasks.map((t) => ({ value: t.id, label: t.taskName }))}
                />
              </Col>
            </Row>
            <Row gutter={12}>
              <Col xs={24} sm={16}>
                <Input
                  placeholder="Description (optional)"
                  value={timerDesc}
                  onChange={(e) => setTimerDesc(e.target.value)}
                />
              </Col>
              <Col xs={24} sm={8}>
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={handleStart}
                  loading={loading}
                  block
                >
                  Start Timer
                </Button>
              </Col>
            </Row>
          </div>
        )}
      </Card>

      <Card title="Recent Time Entries" style={{ marginBottom: 24 }}>
        <Divider style={{ margin: '0 0 16px' }} />
        <Table
          dataSource={recentEntries}
          columns={columns}
          rowKey="id"
          pagination={false}
          size="small"
        />
      </Card>

      {breakdown.length > 0 && (
        <Card title="My Hours Breakdown (This Month)">
          <Divider style={{ margin: '0 0 16px' }} />
          {(() => {
            const totalMins = breakdown.reduce((s, b) => s + b.totalMinutes, 0);
            const byProject: Record<string, { name: string; minutes: number }> = {};
            breakdown.forEach((b) => {
              if (!byProject[b.projectId]) byProject[b.projectId] = { name: b.projectName, minutes: 0 };
              byProject[b.projectId].minutes += b.totalMinutes;
            });
            return (
              <div>
                {Object.values(byProject).map((proj) => (
                  <div key={proj.name} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600 }}>{proj.name}</span>
                      <span style={{ color: '#666' }}>{formatMinutes(proj.minutes)}</span>
                    </div>
                    <Progress
                      percent={Math.round((proj.minutes / totalMins) * 100)}
                      size="small"
                      format={(p) => `${p}%`}
                    />
                    <div style={{ paddingLeft: 16, marginTop: 8 }}>
                      {breakdown
                        .filter((b) => byProject[b.projectId] === proj)
                        .map((b) => (
                          <div
                            key={b.taskId}
                            style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#555', marginBottom: 2 }}
                          >
                            <span>{b.taskName}</span>
                            <span>{formatMinutes(b.totalMinutes)}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </Card>
      )}

      <Modal
        title="Stop Timer & Save"
        open={stopModalOpen}
        onOk={confirmStop}
        onCancel={() => setStopModalOpen(false)}
        okText="Save Entry"
        confirmLoading={loading}
        destroyOnHidden
      >
        <p style={{ marginBottom: 16, color: '#666' }}>
          The time entry will be saved as a Draft. You can add a commit hash below (optional).
        </p>
        <Form form={stopForm} layout="vertical">
          <Form.Item name="relatedCommitHash" label="Related Commit Hash (optional)">
            <Input placeholder="e.g. abc123f" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

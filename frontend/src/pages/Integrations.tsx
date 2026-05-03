import { useEffect, useState, useCallback } from 'react';
import {
  Card, Form, Input, Button, Typography, App, Spin, Row, Col,
  Tag, Divider, Space, Tabs, Table, Badge, Tooltip, Alert, Select,
} from 'antd';
import {
  GithubOutlined, CheckCircleOutlined,
  SyncOutlined, LinkOutlined, BranchesOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { settingsApi } from '../api/settings.api';

dayjs.extend(relativeTime);
import { integrationsApi, type GitCommit, type ClickUpTask, type IntegrationStatus } from '../api/integrations.api';
import { projectsApi } from '../api/projects.api';
import type { Project } from '../types';

const { Title, Text, Paragraph } = Typography;

export default function Integrations() {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [savingGit, setSavingGit] = useState(false);
  const [savingClickUp, setSavingClickUp] = useState(false);
  const [syncingGit, setSyncingGit] = useState(false);
  const [syncingClickUp, setSyncingClickUp] = useState(false);
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [commitsTotal, setCommitsTotal] = useState(0);
  const [commitsPage, setCommitsPage] = useState(1);
  const [clickupTasks, setClickupTasks] = useState<ClickUpTask[]>([]);
  const [clickupTotal, setClickupTotal] = useState(0);
  const [clickupPage, setClickupPage] = useState(1);
  const [projects, setProjects] = useState<Project[]>([]);
  const [filterProject, setFilterProject] = useState<string | undefined>();
  const [gitForm] = Form.useForm();
  const [clickUpForm] = Form.useForm();

  const loadStatus = useCallback(async () => {
    try {
      const res = await integrationsApi.getStatus();
      setStatus(res.data);
    } catch { /* ignore */ }
  }, []);

  const loadCommits = useCallback(async (page = 1) => {
    try {
      const res = await integrationsApi.getCommits({ page, limit: 10 });
      setCommits(res.data.data);
      setCommitsTotal(res.data.total);
    } catch { /* ignore */ }
  }, []);

  const loadClickUpTasks = useCallback(async (page = 1, projectId?: string) => {
    try {
      const res = await integrationsApi.getClickUpTasks({ page, limit: 15, projectId });
      setClickupTasks(res.data.data);
      setClickupTotal(res.data.total);
    } catch { /* ignore */ }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, projectsRes] = await Promise.allSettled([
        settingsApi.findAll(),
        projectsApi.findAll({ limit: 100 }),
      ]);
      if (settingsRes.status === 'fulfilled') {
        const s: Record<string, string> = {};
        settingsRes.value.data.forEach((item) => { s[item.key] = item.value; });
        gitForm.setFieldsValue({ github_token: s['github_token'] ?? '' });
        clickUpForm.setFieldsValue({
          clickup_api_key: s['clickup_api_key'] ?? '',
          clickup_workspace_id: s['clickup_workspace_id'] ?? '',
        });
      }
      if (projectsRes.status === 'fulfilled') setProjects(projectsRes.value.data.data);
      await loadStatus();
      await Promise.all([loadCommits(), loadClickUpTasks()]);
    } finally {
      setLoading(false);
    }
  }, [gitForm, clickUpForm, loadStatus, loadCommits, loadClickUpTasks]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const saveGit = async () => {
    setSavingGit(true);
    try {
      const values = gitForm.getFieldsValue();
      await settingsApi.update('github_token', values.github_token ?? '');
      message.success('Git settings saved');
      await loadStatus();
    } catch { message.error('Failed to save Git settings'); }
    finally { setSavingGit(false); }
  };

  const saveClickUp = async () => {
    setSavingClickUp(true);
    try {
      const values = clickUpForm.getFieldsValue();
      await Promise.all([
        settingsApi.update('clickup_api_key', values.clickup_api_key ?? ''),
        settingsApi.update('clickup_workspace_id', values.clickup_workspace_id ?? ''),
      ]);
      message.success('ClickUp settings saved');
      await loadStatus();
    } catch { message.error('Failed to save ClickUp settings'); }
    finally { setSavingClickUp(false); }
  };

  const handleSyncGit = async () => {
    setSyncingGit(true);
    try {
      const res = await integrationsApi.syncGit();
      const { synced, skipped, errors } = res.data;
      if (errors.length) message.warning(`Synced ${synced}, skipped ${skipped}. Errors: ${errors.join('; ')}`);
      else message.success(`Synced ${synced} commits`);
      await loadStatus();
      await loadCommits(1);
      setCommitsPage(1);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      message.error(msg ?? 'Sync failed');
    } finally { setSyncingGit(false); }
  };

  const handleSyncClickUp = async () => {
    setSyncingClickUp(true);
    try {
      const res = await integrationsApi.syncClickUp();
      const { synced, skipped, errors } = res.data;
      if (errors.length) message.warning(`Synced ${synced}, skipped ${skipped}. Errors: ${errors.join('; ')}`);
      else message.success(`Synced ${synced} ClickUp tasks`);
      await loadStatus();
      await loadClickUpTasks(1, filterProject);
      setClickupPage(1);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      message.error(msg ?? 'Sync failed');
    } finally { setSyncingClickUp(false); }
  };

  const commitColumns = [
    {
      title: 'Date',
      dataIndex: 'commitDate',
      width: 110,
      render: (v: string) => dayjs(v).format('DD/MM/YY HH:mm'),
    },
    {
      title: 'Repository',
      dataIndex: 'repository',
      width: 160,
      render: (v: string) => <Tag icon={<BranchesOutlined />} color="default">{v}</Tag>,
    },
    {
      title: 'Author',
      width: 140,
      render: (_: unknown, r: GitCommit) => (
        <span>
          {r.linkedUser ? (
            <Tag color="blue">{r.linkedUser.fullName}</Tag>
          ) : (
            <Tooltip title={r.authorEmail}>
              <Tag color="default">{r.authorName}</Tag>
            </Tooltip>
          )}
        </span>
      ),
    },
    {
      title: 'Message',
      dataIndex: 'commitMessage',
      render: (v: string) => (
        <Tooltip title={v}>
          <span style={{ fontSize: 12 }}>{v.split('\n')[0].slice(0, 80)}{v.length > 80 ? '…' : ''}</span>
        </Tooltip>
      ),
    },
    {
      title: 'Hash',
      dataIndex: 'commitHash',
      width: 90,
      render: (v: string) => <code style={{ fontSize: 11 }}>{v.slice(0, 7)}</code>,
    },
    {
      title: 'Linked',
      width: 80,
      render: (_: unknown, r: GitCommit) => r.linkedTimeEntryId
        ? <Tag color="success" icon={<LinkOutlined />}>Linked</Tag>
        : <Tag color="default">—</Tag>,
    },
  ];

  const clickupColumns = [
    {
      title: 'Task',
      dataIndex: 'taskName',
      render: (v: string, r: ClickUpTask) => (
        <div>
          <div style={{ fontWeight: 500, fontSize: 13 }}>{v}</div>
          <div style={{ fontSize: 11, color: '#aaa' }}>#{r.clickUpTaskId}</div>
        </div>
      ),
    },
    {
      title: 'Project',
      dataIndex: ['project', 'projectName'],
      width: 140,
      render: (v: string) => v ? <Tag color="blue">{v}</Tag> : '—',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 110,
      render: (v: string) => v ? <Tag>{v}</Tag> : '—',
    },
    {
      title: 'Est. Time',
      dataIndex: 'estimatedTime',
      width: 100,
      render: (v: number) => v ? `${Math.floor(v / 60)}h ${v % 60}m` : '—',
    },
    {
      title: 'Due',
      dataIndex: 'dueDate',
      width: 110,
      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '—',
    },
    {
      title: 'Last Sync',
      dataIndex: 'lastSyncDate',
      width: 110,
      render: (v: string) => dayjs(v).fromNow(),
    },
  ];

  if (loading) return <Spin style={{ display: 'block', marginTop: 40 }} />;

  const gitConfigured = status?.git.configured ?? false;
  const clickupConfigured = status?.clickup.configured ?? false;

  return (
    <div>
      <Title level={4} style={{ marginTop: 0, marginBottom: 24 }}>Integrations</Title>

      {/* Status row */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12}>
          <Card size="small" style={{ borderLeft: `4px solid ${gitConfigured ? '#52c41a' : '#d9d9d9'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <GithubOutlined style={{ fontSize: 22 }} />
              <div>
                <div style={{ fontWeight: 600 }}>GitHub</div>
                <div style={{ fontSize: 12, color: '#888' }}>
                  {status?.git.projectsConfigured ?? 0} repos · {status?.git.commitsSynced ?? 0} commits synced
                </div>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                {gitConfigured
                  ? <Badge status="success" text="Connected" />
                  : <Badge status="default" text="Not configured" />}
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card size="small" style={{ borderLeft: `4px solid ${clickupConfigured ? '#7b68ee' : '#d9d9d9'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <CheckCircleOutlined style={{ fontSize: 22, color: '#7b68ee' }} />
              <div>
                <div style={{ fontWeight: 600 }}>ClickUp</div>
                <div style={{ fontSize: 12, color: '#888' }}>
                  {status?.clickup.projectsConfigured ?? 0} lists · {status?.clickup.tasksSynced ?? 0} tasks synced
                </div>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                {clickupConfigured
                  ? <Badge status="processing" text="Connected" />
                  : <Badge status="default" text="Not configured" />}
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <Tabs
        defaultActiveKey="git"
        items={[
          {
            key: 'git',
            label: <span><GithubOutlined /> Git Commits</span>,
            children: (
              <div>
                <Row gutter={24}>
                  <Col xs={24} lg={10}>
                    <Card title="GitHub Settings" size="small" style={{ marginBottom: 16 }}>
                      <Paragraph type="secondary" style={{ fontSize: 12 }}>
                        Connect GitHub to automatically sync commits and link them to time entries.
                        Commits are matched to employees by their git email address.
                      </Paragraph>
                      <Form form={gitForm} layout="vertical">
                        <Form.Item name="github_token" label="Personal Access Token">
                          <Input.Password placeholder="ghp_xxxxxxxxxxxx" />
                        </Form.Item>
                        <Button type="primary" onClick={saveGit} loading={savingGit}>
                          Save
                        </Button>
                      </Form>
                      <Divider style={{ margin: '12px 0' }} />
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        Set the Git Repository URL per project in the Projects page.
                        The token needs <code>repo</code> scope.
                      </Text>
                    </Card>
                  </Col>
                  <Col xs={24} lg={14}>
                    {!gitConfigured && (
                      <Alert
                        type="warning"
                        message="GitHub token not configured"
                        description="Add your GitHub Personal Access Token and save before syncing."
                        style={{ marginBottom: 16 }}
                        showIcon
                      />
                    )}
                    {gitConfigured && status?.git.projectsConfigured === 0 && (
                      <Alert
                        type="info"
                        message="No repositories configured"
                        description="Add Git Repository URLs to your projects in the Projects page."
                        style={{ marginBottom: 16 }}
                        showIcon
                      />
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <Text strong>Synced Commits ({commitsTotal})</Text>
                      <Button
                        type="primary"
                        icon={<SyncOutlined spin={syncingGit} />}
                        onClick={handleSyncGit}
                        loading={syncingGit}
                        disabled={!gitConfigured}
                      >
                        Sync Now
                      </Button>
                    </div>
                    <Table
                      dataSource={commits}
                      columns={commitColumns}
                      rowKey="id"
                      size="small"
                      scroll={{ x: 700 }}
                      pagination={{
                        current: commitsPage,
                        total: commitsTotal,
                        pageSize: 10,
                        onChange: (p) => { setCommitsPage(p); loadCommits(p); },
                        showTotal: (t) => `${t} commits`,
                        size: 'small',
                      }}
                      locale={{ emptyText: 'No commits synced yet. Click "Sync Now" to pull commits from GitHub.' }}
                    />
                  </Col>
                </Row>
              </div>
            ),
          },
          {
            key: 'clickup',
            label: <span><CheckCircleOutlined /> ClickUp Tasks</span>,
            children: (
              <div>
                <Row gutter={24}>
                  <Col xs={24} lg={10}>
                    <Card title="ClickUp Settings" size="small" style={{ marginBottom: 16 }}>
                      <Paragraph type="secondary" style={{ fontSize: 12 }}>
                        Connect ClickUp to sync tasks and allow employees to link time entries
                        to real ClickUp tasks. Tasks are matched to employees by email.
                      </Paragraph>
                      <Form form={clickUpForm} layout="vertical">
                        <Form.Item name="clickup_api_key" label="API Key">
                          <Input.Password placeholder="pk_xxxxxxxxxxxx" />
                        </Form.Item>
                        <Form.Item name="clickup_workspace_id" label="Workspace ID">
                          <Input placeholder="e.g. 12345678" />
                        </Form.Item>
                        <Button type="primary" onClick={saveClickUp} loading={savingClickUp}>
                          Save
                        </Button>
                      </Form>
                      <Divider style={{ margin: '12px 0' }} />
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        Set the ClickUp List ID per project in the Projects page.
                      </Text>
                    </Card>
                  </Col>
                  <Col xs={24} lg={14}>
                    {!clickupConfigured && (
                      <Alert
                        type="warning"
                        message="ClickUp API key not configured"
                        description="Add your ClickUp API Key and save before syncing."
                        style={{ marginBottom: 16 }}
                        showIcon
                      />
                    )}
                    {clickupConfigured && status?.clickup.projectsConfigured === 0 && (
                      <Alert
                        type="info"
                        message="No ClickUp lists configured"
                        description="Add ClickUp List IDs to your projects in the Projects page."
                        style={{ marginBottom: 16 }}
                        showIcon
                      />
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <Space>
                        <Text strong>Synced Tasks ({clickupTotal})</Text>
                        <Select
                          placeholder="All projects"
                          style={{ width: 160 }}
                          allowClear
                          size="small"
                          value={filterProject}
                          onChange={(v) => {
                            setFilterProject(v);
                            setClickupPage(1);
                            loadClickUpTasks(1, v);
                          }}
                          options={projects
                            .filter((p) => p.externalClickUpListId)
                            .map((p) => ({ value: p.id, label: p.projectName }))}
                        />
                      </Space>
                      <Button
                        type="primary"
                        icon={<SyncOutlined spin={syncingClickUp} />}
                        onClick={handleSyncClickUp}
                        loading={syncingClickUp}
                        disabled={!clickupConfigured}
                        style={{ background: '#7b68ee', borderColor: '#7b68ee' }}
                      >
                        Sync Now
                      </Button>
                    </div>
                    <Table
                      dataSource={clickupTasks}
                      columns={clickupColumns}
                      rowKey="id"
                      size="small"
                      scroll={{ x: 700 }}
                      pagination={{
                        current: clickupPage,
                        total: clickupTotal,
                        pageSize: 15,
                        onChange: (p) => { setClickupPage(p); loadClickUpTasks(p, filterProject); },
                        showTotal: (t) => `${t} tasks`,
                        size: 'small',
                      }}
                      locale={{ emptyText: 'No tasks synced yet. Click "Sync Now" to pull tasks from ClickUp.' }}
                    />
                  </Col>
                </Row>
              </div>
            ),
          },
          {
            key: 'mapping',
            label: 'Field Mapping',
            children: (
              <Card>
                <Paragraph type="secondary">
                  How TimeIn fields map to external systems.
                </Paragraph>
                <Row gutter={24}>
                  <Col xs={24} md={12}>
                    <Text strong><GithubOutlined /> Git</Text>
                    <ul style={{ marginTop: 8, paddingLeft: 20, color: '#555', lineHeight: 2 }}>
                      <li>Commit Hash → <Tag>relatedCommitHash</Tag> on TimeEntry</li>
                      <li>Author Email → matched to <Tag>User.email</Tag></li>
                      <li>Commit message <Tag>#task-id</Tag> → auto-linked to Task</li>
                      <li>Repository URL → configured on Project</li>
                    </ul>
                  </Col>
                  <Col xs={24} md={12}>
                    <Text strong><CheckCircleOutlined style={{ color: '#7b68ee' }} /> ClickUp</Text>
                    <ul style={{ marginTop: 8, paddingLeft: 20, color: '#555', lineHeight: 2 }}>
                      <li>Task ID → <Tag>relatedClickUpTaskId</Tag> on TimeEntry</li>
                      <li>Task ID → <Tag>clickUpTaskId</Tag> on Task</li>
                      <li>Assignee Email → matched to <Tag>User.email</Tag></li>
                      <li>List ID → configured on Project</li>
                    </ul>
                  </Col>
                </Row>
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}

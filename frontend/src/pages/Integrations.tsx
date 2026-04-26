import { useEffect, useState } from 'react';
import {
  Card, Form, Input, Button, Typography, App, Spin, Row, Col, Tag, Divider, Space,
} from 'antd';
import {
  GithubOutlined, CheckCircleOutlined, CloseCircleOutlined, SyncOutlined,
} from '@ant-design/icons';
import { settingsApi } from '../api/settings.api';

const { Title, Text, Paragraph } = Typography;

export default function Integrations() {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [savingGit, setSavingGit] = useState(false);
  const [savingClickUp, setSavingClickUp] = useState(false);
  const [gitForm] = Form.useForm();
  const [clickUpForm] = Form.useForm();

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await settingsApi.findAll();
      const s: Record<string, string> = {};
      res.data.forEach((item) => { s[item.key] = item.value; });
      gitForm.setFieldsValue({ github_token: s['github_token'] ?? '' });
      clickUpForm.setFieldsValue({ clickup_api_key: s['clickup_api_key'] ?? '', clickup_workspace_id: s['clickup_workspace_id'] ?? '' });
    } catch {
      // ignore — settings may not exist yet
    } finally {
      setLoading(false);
    }
  };

  const saveGit = async () => {
    setSavingGit(true);
    try {
      const values = gitForm.getFieldsValue();
      await settingsApi.update('github_token', values.github_token ?? '');
      message.success('Git settings saved');
    } catch {
      message.error('Failed to save Git settings');
    } finally {
      setSavingGit(false);
    }
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
    } catch {
      message.error('Failed to save ClickUp settings');
    } finally {
      setSavingClickUp(false);
    }
  };

  if (loading) return <Spin style={{ display: 'block', marginTop: 40 }} />;

  return (
    <div>
      <Title level={4} style={{ marginTop: 0, marginBottom: 24 }}>Integrations</Title>

      <Row gutter={24}>
        {/* Git Integration */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <GithubOutlined style={{ fontSize: 18 }} />
                <span>Git Integration</span>
                <Tag color="processing" icon={<SyncOutlined spin={false} />}>Beta</Tag>
              </Space>
            }
            style={{ marginBottom: 24 }}
          >
            <Paragraph type="secondary">
              Connect your GitHub / GitLab account to link commits to time entries.
              Commits can be associated with tasks based on branch names or commit messages.
            </Paragraph>
            <Divider />

            <div style={{ marginBottom: 16 }}>
              <Text strong>Capabilities:</Text>
              <ul style={{ marginTop: 8, paddingLeft: 20, color: '#555' }}>
                <li>Pull commits from GitHub repositories</li>
                <li>Link commits to employees by email</li>
                <li>Auto-detect task from commit message or branch name</li>
                <li>Save commit hash manually on time entries</li>
              </ul>
            </div>

            <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Text strong>Status:</Text>
              <Tag
                icon={<CloseCircleOutlined />}
                color="default"
              >
                Not configured
              </Tag>
            </div>

            <Form form={gitForm} layout="vertical">
              <Form.Item name="github_token" label="GitHub Personal Access Token">
                <Input.Password placeholder="ghp_xxxxxxxxxxxx" />
              </Form.Item>
              <Button type="primary" onClick={saveGit} loading={savingGit}>
                Save Git Settings
              </Button>
            </Form>

            <Divider />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Per-project Git repository URL can be configured in the Projects page.
            </Text>
          </Card>
        </Col>

        {/* ClickUp Integration */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <CheckCircleOutlined style={{ fontSize: 18, color: '#7b68ee' }} />
                <span>ClickUp Integration</span>
                <Tag color="processing" icon={<SyncOutlined spin={false} />}>Beta</Tag>
              </Space>
            }
            style={{ marginBottom: 24 }}
          >
            <Paragraph type="secondary">
              Connect ClickUp to sync tasks and link time entries to real tasks
              from your team's project management system.
            </Paragraph>
            <Divider />

            <div style={{ marginBottom: 16 }}>
              <Text strong>Capabilities:</Text>
              <ul style={{ marginTop: 8, paddingLeft: 20, color: '#555' }}>
                <li>Sync tasks from ClickUp lists</li>
                <li>Assign ClickUp tasks to employees</li>
                <li>Select existing ClickUp task when logging time</li>
                <li>Store ClickUp Task ID on time entries</li>
              </ul>
            </div>

            <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Text strong>Status:</Text>
              <Tag
                icon={<CloseCircleOutlined />}
                color="default"
              >
                Not configured
              </Tag>
            </div>

            <Form form={clickUpForm} layout="vertical">
              <Form.Item name="clickup_api_key" label="ClickUp API Key">
                <Input.Password placeholder="pk_xxxxxxxxxxxx" />
              </Form.Item>
              <Form.Item name="clickup_workspace_id" label="Workspace ID">
                <Input placeholder="e.g. 12345678" />
              </Form.Item>
              <Button type="primary" onClick={saveClickUp} loading={savingClickUp}>
                Save ClickUp Settings
              </Button>
            </Form>

            <Divider />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Per-project ClickUp List ID can be configured in the Projects page.
            </Text>
          </Card>
        </Col>
      </Row>

      <Card title="Field Mapping" style={{ marginBottom: 24 }}>
        <Paragraph type="secondary">
          The table below shows how TimeIn fields map to external systems.
        </Paragraph>
        <Row gutter={24}>
          <Col xs={24} md={12}>
            <Text strong>Git</Text>
            <ul style={{ marginTop: 8, paddingLeft: 20, color: '#555', lineHeight: 2 }}>
              <li>Commit Hash → <Tag>relatedCommitHash</Tag> on TimeEntry</li>
              <li>Commit Author Email → matched to User.email</li>
              <li>Repository URL → configured on Project</li>
            </ul>
          </Col>
          <Col xs={24} md={12}>
            <Text strong>ClickUp</Text>
            <ul style={{ marginTop: 8, paddingLeft: 20, color: '#555', lineHeight: 2 }}>
              <li>Task ID → <Tag>relatedClickUpTaskId</Tag> on TimeEntry</li>
              <li>Task ID → <Tag>clickUpTaskId</Tag> on Task</li>
              <li>List ID → configured on Project</li>
            </ul>
          </Col>
        </Row>
      </Card>
    </div>
  );
}

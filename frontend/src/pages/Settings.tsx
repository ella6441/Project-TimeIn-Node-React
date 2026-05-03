import { useEffect, useState } from 'react';
import {
  Card, Form, Switch, InputNumber, Button, Typography, App, Spin, Select, Row, Col, Divider,
} from 'antd';
import { settingsApi } from '../api/settings.api';

const { Title, Text } = Typography;

const DEFAULT_WORK_TYPES = ['DEVELOPMENT', 'DESIGN', 'MEETINGS', 'REVIEW', 'TESTING', 'OTHER'];

export default function Settings() {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const res = await settingsApi.findAll();
      const settings: Record<string, string> = {};
      res.data.forEach((s) => { settings[s.key] = s.value; });
      form.setFieldsValue({
        allow_retroactive: settings['allow_retroactive'] !== 'false',
        max_retroactive_days: parseInt(settings['max_retroactive_days'] ?? '30', 10),
        max_daily_hours: parseInt(settings['max_daily_hours'] ?? '10', 10),
        require_description: settings['require_description'] === 'true',
        require_work_type: settings['require_work_type'] === 'true',
        work_types: (settings['work_types'] ?? DEFAULT_WORK_TYPES.join(',')).split(',').map((s) => s.trim()).filter(Boolean),
        task_statuses: (settings['task_statuses'] ?? 'TODO,IN_PROGRESS,DONE,CANCELLED').split(',').map((s) => s.trim()).filter(Boolean),
      });
    } catch {
      message.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    const values = form.getFieldsValue();
    setSaving(true);
    try {
      await Promise.all([
        settingsApi.update('allow_retroactive', values.allow_retroactive ? 'true' : 'false'),
        settingsApi.update('max_retroactive_days', String(values.max_retroactive_days)),
        settingsApi.update('max_daily_hours', String(values.max_daily_hours)),
        settingsApi.update('require_description', values.require_description ? 'true' : 'false'),
        settingsApi.update('require_work_type', values.require_work_type ? 'true' : 'false'),
        settingsApi.update('work_types', (values.work_types as string[]).join(',')),
        settingsApi.update('task_statuses', (values.task_statuses as string[]).join(',')),
      ]);
      message.success('Settings saved');
    } catch {
      message.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spin style={{ display: 'block', marginTop: 40 }} />;

  return (
    <div>
      <Title level={4} style={{ marginTop: 0, marginBottom: 24 }}>System Settings</Title>

      <Form form={form} layout="vertical" onFinish={handleSave}>
        <Row gutter={24}>
          <Col xs={24} lg={12}>
            <Card title="Reporting Rules" style={{ marginBottom: 24 }}>
              <Form.Item
                name="allow_retroactive"
                label="Allow Retroactive Reporting"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
              <Text type="secondary" style={{ display: 'block', marginTop: -16, marginBottom: 16, fontSize: 12 }}>
                Allow employees to log time entries for past dates
              </Text>

              <Form.Item
                name="max_retroactive_days"
                label="Max Retroactive Days"
                rules={[{ required: true, type: 'number', min: 1, max: 365 }]}
              >
                <InputNumber min={1} max={365} style={{ width: '100%' }} />
              </Form.Item>
              <Text type="secondary" style={{ display: 'block', marginTop: -16, marginBottom: 16, fontSize: 12 }}>
                Maximum number of past days employees can log time for
              </Text>

              <Form.Item
                name="max_daily_hours"
                label="Max Daily Hours"
                rules={[{ required: true, type: 'number', min: 1, max: 24 }]}
              >
                <InputNumber min={1} max={24} style={{ width: '100%' }} />
              </Form.Item>
              <Text type="secondary" style={{ display: 'block', marginTop: -16, marginBottom: 16, fontSize: 12 }}>
                Maximum hours an employee can log per day (enforced on creation)
              </Text>

              <Divider />

              <Form.Item
                name="require_description"
                label="Require Description"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
              <Text type="secondary" style={{ display: 'block', marginTop: -16, marginBottom: 16, fontSize: 12 }}>
                Employees must fill in a description when logging time
              </Text>

              <Form.Item
                name="require_work_type"
                label="Require Work Type"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
              <Text type="secondary" style={{ display: 'block', marginTop: -16, fontSize: 12 }}>
                Employees must select a work type when logging time
              </Text>
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card title="System Fields" style={{ marginBottom: 24 }}>
              <Form.Item
                name="work_types"
                label="Work Types"
                rules={[{ required: true, type: 'array', min: 1, message: 'At least one work type required' }]}
              >
                <Select
                  mode="tags"
                  style={{ width: '100%' }}
                  placeholder="Type and press Enter to add work types"
                  tokenSeparators={[',']}
                />
              </Form.Item>
              <Text type="secondary" style={{ fontSize: 12 }}>
                The list of work types employees can choose when logging time.
                You can add custom types by typing and pressing Enter.
              </Text>

              <Divider />

              <Form.Item
                name="task_statuses"
                label="Task Statuses"
                rules={[{ required: true, type: 'array', min: 1, message: 'At least one status required' }]}
              >
                <Select
                  mode="tags"
                  style={{ width: '100%' }}
                  placeholder="Type and press Enter to add task statuses"
                  tokenSeparators={[',']}
                />
              </Form.Item>
              <Text type="secondary" style={{ fontSize: 12 }}>
                The list of statuses available for tasks (e.g. TODO, IN_PROGRESS, DONE).
                You can add or remove statuses by typing and pressing Enter.
              </Text>
            </Card>
          </Col>
        </Row>

        <Button type="primary" htmlType="submit" loading={saving}>
          Save Settings
        </Button>
      </Form>
    </div>
  );
}

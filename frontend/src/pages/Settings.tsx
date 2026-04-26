import { useEffect, useState } from 'react';
import {
  Card, Form, Switch, InputNumber, Button, Typography, App, Spin,
} from 'antd';
import { settingsApi } from '../api/settings.api';

const { Title, Text } = Typography;

export default function Settings() {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await settingsApi.findAll();
      const settings: Record<string, string> = {};
      res.data.forEach((s) => { settings[s.key] = s.value; });
      form.setFieldsValue({
        allow_retroactive: settings['allow_retroactive'] !== 'false',
        max_retroactive_days: parseInt(settings['max_retroactive_days'] ?? '30', 10),
      });
    } catch {
      message.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const values = form.getFieldsValue();
    setSaving(true);
    try {
      await Promise.all([
        settingsApi.update('allow_retroactive', values.allow_retroactive ? 'true' : 'false'),
        settingsApi.update('max_retroactive_days', String(values.max_retroactive_days)),
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

      <Card style={{ maxWidth: 500 }}>
        <Form form={form} layout="vertical" onFinish={handleSave}>
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
          <Text type="secondary" style={{ display: 'block', marginTop: -16, marginBottom: 24, fontSize: 12 }}>
            Maximum number of past days employees can report time for
          </Text>

          <Button type="primary" htmlType="submit" loading={saving}>
            Save Settings
          </Button>
        </Form>
      </Card>
    </div>
  );
}

import Page from '../components/Page.jsx'
import { EmptyState } from '../components/States.jsx'

export default function Friends() {
  return (
    <Page title="Friends">
      <EmptyState title="No friends yet" message="Friends and the activity feed are coming soon." />
    </Page>
  )
}

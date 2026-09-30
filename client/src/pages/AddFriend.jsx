import Page from '../components/Page.jsx'
import { EmptyState } from '../components/States.jsx'

export default function AddFriend() {
  return (
    <Page title="Add friend">
      <EmptyState title="Friend search is coming soon" message="You will be able to find friends by username here." />
    </Page>
  )
}

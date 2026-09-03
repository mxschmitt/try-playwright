import React from 'react';

import styles from './Footer.module.css'

const REPO_COMMIT_URL = 'https://github.com/mxschmitt/try-playwright/commit'

type FooterProps = {
  sha?: string
}

const Footer: React.FunctionComponent<FooterProps> = ({ sha }) => {
  const gitSha = (sha ?? import.meta.env.VITE_GIT_SHA ?? '').trim()
  const shortSha = gitSha.slice(0, 7)
  if (!shortSha) {
    return null
  }
  return (
    <footer className={styles.footer}>
      Deployed{' '}
      <a
        href={`${REPO_COMMIT_URL}/${gitSha}`}
        target="_blank"
        rel="noopener noreferrer"
        title={gitSha}
      >
        {shortSha}
      </a>
    </footer>
  )
}

export default Footer

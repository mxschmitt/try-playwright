import React from 'react'

import styles from './index.module.css'

interface ResponseFileProps {
    file: FileWrapper;
}

const ResponseFile: React.FunctionComponent<ResponseFileProps> = ({ file }) => {
    const { publicURL, fileName, extension } = file
    return <p className={styles.responseFile} data-test-id="file">
        <span className="file-name">{fileName}</span>
        {extension === ".pdf" ? <>
            <object type="application/pdf" data={publicURL} className={styles.pdfFile} >
                {fileName}
            </object>
        </> : extension === ".mp4" ? <>
            <video autoPlay muted className={styles.video} controls loop>
                <source src={publicURL} type="video/mp4" />
            </video>
        </> : extension === ".webm" ? <>
            <video autoPlay muted className={styles.video} controls loop>
                <source src={publicURL} type="video/webm" />
            </video>
        </> : <>
            <img src={publicURL} alt={fileName} className={styles.image} />
        </>}
    </p>
}

export default ResponseFile
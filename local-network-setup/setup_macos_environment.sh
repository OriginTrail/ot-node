#!/bin/sh
pathToOtNode=$(cd .. && pwd)

osascript -e "
  tell app \"Terminal\"
      do script \"cd $pathToOtNode && node index.js ./local-network-setup/.bootstrap_origintrail_noderc\"
  end tell
  "

osascript -e "
  tell app \"Terminal\"
      do script \"cd $pathToOtNode && node index.js ./local-network-setup/.dh1_origintrail_noderc\"
  end tell
  "


osascript -e "
  tell app \"Terminal\"
      do script \"cd $pathToOtNode && node index.js ./local-network-setup/.dh2_origintrail_noderc\"
  end tell
  "

  osascript -e "
    tell app \"Terminal\"
        do script \"cd $pathToOtNode && node index.js ./local-network-setup/.dh3_origintrail_noderc\"
    end tell
    "

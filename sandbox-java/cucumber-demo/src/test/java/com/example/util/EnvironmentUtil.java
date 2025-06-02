package com.example.util;

import java.util.*;
import org.junit.platform.commons.util.*;

public class EnvironmentUtil {

    private static Map<String, String> ENVIRONMENT_VALUES = new HashMap<>();

    public static String getValue(String key, String defaultValue) {
        String value = ENVIRONMENT_VALUES.get(key);
        if (StringUtils.isBlank(value)) {
            value = System.getenv(key);
            if (StringUtils.isBlank(value)) {
                value = defaultValue;
            }
            ENVIRONMENT_VALUES.put(key, value);
            return value;
        }
        return value;
    }
}
